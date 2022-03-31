import fetch from "node-fetch";
import { Data, DataLookups, Photo, Plant, WaterUseCode } from "./types";
import { Context } from "@azure/functions";

import dataLookups from "./data-lookups.json";

const baseUrl = "https://wucolsplants.sf.ucdavis.edu";

const plantTypeCodeByName: { [key: string]: string } = (() => {
  const typeCodeByName: { [key: string]: string } = {};

  dataLookups.plantTypes.forEach((plantType) => {
    typeCodeByName[plantType.name] = plantType.code;
  });

  return typeCodeByName;
})();

const logJson = (json: any) => {
  console.log(JSON.stringify(json, null, 2));
};

const getRawData = async (context: Context): Promise<any> => {
  const url =
    baseUrl +
    "/jsonapi/" +
    "node/plant_database_item" +
    "?fields[node--plant_database_item]=field_botanical_name,title,field_plant_type,field_thumbnail,field_image_s_,field_cultural_information," +
    "field_region_1_water_use,field_region_2_water_use,field_region_3_water_use,field_region_4_water_use,field_region_5_water_use,field_region_6_water_use" +
    "&include=field_region_1_water_use,field_plant_type,field_thumbnail,field_image_s_" +
    "&fields[taxonomy_term--water_use]=name" +
    "&fields[file--file]=uri";

  let page = 1;

  context.log("Fetching page: ", page);
  let rawData: any = await fetch(url).then((r) => r.json());

  const included: { [key: string]: any } = {};
  const data: any[] = [];

  do {
    data.push(...rawData.data);
    rawData.included?.forEach((item: any) => {
      included[item.id] = item;
    });

    if (rawData.links?.next) {
      page++;
      context.log("Fetching page: ", page);
      rawData = await fetch(rawData.links.next).then((r) => r.json());
    } else {
      rawData = null;
    }
  } while (rawData !== null);

  return { data, included: Object.values(included) };
};

const getWaterUseCodeByGuidLookups = (
  included: any[]
): { [key: string]: WaterUseCode } => {
  const waterUses = included.filter(
    (item: any) => item.type === "taxonomy_term--water_use"
  );

  const waterUseLookups: { [key: string]: WaterUseCode } = {};

  waterUses.forEach((waterUse: any) => {
    switch (waterUse.attributes.name.toLowerCase()) {
      case "very low":
        waterUseLookups[waterUse.id] = "VL";
        break;
      case "low":
        waterUseLookups[waterUse.id] = "LO";
        break;
      case "moderate":
        waterUseLookups[waterUse.id] = "M";
        break;
      case "high":
        waterUseLookups[waterUse.id] = "H";
        break;
      case "unknown":
        waterUseLookups[waterUse.id] = "U";
        break;
      case "not appropriate for this region":
        waterUseLookups[waterUse.id] = "NA";
        break;
      default:
        console.log("Unknown water use:", waterUse.attributes.name);
        throw new Error("Unknown water use");
    }
  });

  return waterUseLookups;
};

const getPlantTypeNameByGuidLookups = (
  included: any[]
): { [key: string]: string } => {
  const plantTypes = included.filter(
    (item: any) => item.type === "taxonomy_term--plant_type"
  );

  const plantTypeLookups: { [key: string]: string } = {};

  plantTypes.forEach((plantType) => {
    plantTypeLookups[plantType.id] = plantType.attributes.name;
  });

  return plantTypeLookups;
};

const getImageUrlByGuidLookups = (
  included: any[]
): { [key: string]: string } => {
  const images = included.filter((item: any) => item.type === "file--file");

  const urlLookups: { [key: string]: string } = {};

  images.forEach((plantType) => {
    urlLookups[plantType.id] = baseUrl + plantType.attributes.uri.url;
  });

  return urlLookups;
};

const getWaterUseRegionsForItem = (
  item: any,
  waterUseLookups: { [key: string]: WaterUseCode }
) => {
  return [
    item.relationships.field_region_1_water_use
      ? waterUseLookups[item.relationships.field_region_1_water_use.data.id] ||
        "U"
      : "NA",
    item.relationships.field_region_2_water_use
      ? waterUseLookups[item.relationships.field_region_2_water_use.data.id] ||
        "U"
      : "NA",
    item.relationships.field_region_3_water_use
      ? waterUseLookups[item.relationships.field_region_3_water_use.data.id] ||
        "U"
      : "NA",
    item.relationships.field_region_4_water_use
      ? waterUseLookups[item.relationships.field_region_4_water_use.data.id] ||
        "U"
      : "NA",
    item.relationships.field_region_5_water_use
      ? waterUseLookups[item.relationships.field_region_5_water_use.data.id] ||
        "U"
      : "NA",
    item.relationships.field_region_6_water_use
      ? waterUseLookups[item.relationships.field_region_6_water_use.data.id] ||
        "U"
      : "NA",
  ];
};

const getPlantTypeCodesForItem = (
  item: any,
  plantTypeNameByGuid: { [key: string]: string }
): string[] => {
  return item.relationships.field_plant_type.data.map(
    (d: any) => plantTypeCodeByName[plantTypeNameByGuid[d.id]]
  );
};

const getThumbnailPhotos = (
  items: any[],
  urlLookups: { [key: string]: string }
): { [key: string]: Photo } => {
  const photos: { [key: string]: Photo } = {};

  items
    .filter((item: any) => !!item.relationships.field_thumbnail?.data?.id)
    .forEach((item: any) => {
      const url = urlLookups[item.relationships.field_thumbnail.data.id];
      const photo = {
        small: {
          url: url,
          width: item.relationships.field_thumbnail.data.meta.width,
          height: item.relationships.field_thumbnail.data.meta.height,
        },
        caption: item.attributes.field_botanical_name,
        filename:
          item.attributes.field_botanical_name.replace(
            /[\\/:"'*?<>|\s]+/g,
            "_"
          ) +
          "_thumbnail." +
          url.split(".").pop(),
      } as unknown as Photo;
      photos[item.attributes.field_botanical_name] = photo;
    });

  return photos;
};

const getPlantPhotos = (
  item: any,
  urlLookups: { [key: string]: string }
): Photo[] => {
  return (item.relationships.field_image_s_?.data || []).map(
    (image: any, ix: number) => {
      const url = urlLookups[image.id];
      return {
        small: {
          url: url,
          width: image.meta.width,
          height: image.meta.height,
        },
        caption: item.attributes.field_botanical_name + " " + (ix + 1),
        filename:
          item.attributes.field_botanical_name.replace(
            /[\\/:"'*?<>|\s]+/g,
            "_"
          ) +
          "_" +
          (ix + 1) +
          "." +
          url.split(".").pop(),
      } as unknown as Photo;
    }
  );
};

const getPlants = async (
  rawData: any,
  urlLookups: { [key: string]: string }
): Promise<Plant[]> => {
  const waterUseLookups: { [key: string]: WaterUseCode } =
    getWaterUseCodeByGuidLookups(rawData.included);

  const plantTypeNameByGuidLookups: { [key: string]: string } =
    getPlantTypeNameByGuidLookups(rawData.included);

  let i = 0;
  const plants = rawData.data.map((item: any) => {
    return {
      id: i++,
      url_keyword: item.attributes.field_botanical_name.replace(/\s/g, "_"),
      botanicalName: item.attributes.field_botanical_name,
      photos: getPlantPhotos(item, urlLookups),
      commonName: item.attributes.title,
      types: getPlantTypeCodesForItem(item, plantTypeNameByGuidLookups),
      culturalInformation:
        item.attributes.field_cultural_information?.value || "",
      waterUseByRegion: getWaterUseRegionsForItem(item, waterUseLookups),
    } as Plant;
  });

  return plants;
};

export const getData = async (context: Context): Promise<Data> => {
  const rawData = await getRawData(context);

  const urlLookups: { [key: string]: string } = getImageUrlByGuidLookups(
    rawData.included
  );

  const thumbnailPhotos = getThumbnailPhotos(rawData.data, urlLookups);

  return {
    ...(dataLookups as unknown as DataLookups),
    plants: await getPlants(rawData, urlLookups),
    photos: thumbnailPhotos,
  } as Data;
};
