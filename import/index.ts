import fs from "fs";
import fetch from "node-fetch";

const wucols = require("./WUCOLS.json");

const baseUrl = "https://playground.sf.ucdavis.edu/jsonapi/";
const apiUser = "apiuser2";
const apiPass = "";

// maps water use from spreadsheet to plant type in API
const waterUseMapper = (waterUse: string): string => {
  switch (waterUse) {
    case "VL":
      return "Very Low";
    case "LO":
      return "Low";
    case "M":
      return "Moderate";
    case "H":
      return "High";
    case "U":
      return "Unknown";
    case "NA":
      return "Not Appropriate for this Region";
    default:
      console.log("Unknown water use:", waterUse);
      throw new Error("Unknown water use");
  }
};

const plantTypeMapper = (plantType: string): string => {
  switch (plantType) {
    case "S":
      return "S (Shrub)";
    case "N":
      return "N (California Native)";
    case "T":
      return "T (Tree)";
    default:
      return "T (Tree)"; // TODO: remove after testing
  }
};

// Step 1: Read out SiteFarm plant type and water use lookups
const getLookups = async (): Promise<Lookups> => {
  const waterUseUrl = baseUrl + "taxonomy_term/water_use";

  const waterUseRequest = await fetch(waterUseUrl);
  const waterUseData: any = await waterUseRequest.json();

  const waterUses: Lookup[] = waterUseData.data.map((item: any) => {
    return {
      id: item.id,
      name: item.attributes.name,
    };
  });

  // TODO: same with plant types
  const plantTypesUrl = baseUrl + "taxonomy_term/pp";

  const plantTypesRequest = await fetch(plantTypesUrl);
  const plantTypesData: any = await plantTypesRequest.json();

  const plantTypes: Lookup[] = plantTypesData.data.map((item: any) => {
    return {
      id: item.id,
      name: item.attributes.name,
    };
  });

  return {
    plantTypes,
    waterUses,
  };
};

// Step 2: Read all plants from JSON file
const getPlants = (): Plant[] => {
  const plants: Plant[] = wucols.plants.map((plant: any) => ({
    botanicalName: plant.botanicalName,
    commonName: plant.commonName,
    types: plant.types.map(plantTypeMapper),
    waterUseByRegion: plant.waterUseByRegion.map(waterUseMapper),
    photoUrls: plant.photos.map((photo: any) => photo.full.url),
  }));

  return plants;
};

// Step 3: For each plant, upload if not already in SiteFarm
const uploadPlants = async (plants: Plant[], lookups: Lookups) => {
  // For now, only upload subset of plants for testing
  const totalPlants = 200; // plants.length;
  for (let i = 0; i < totalPlants; i++) {
    const plant = plants[i];

    console.log(plant);

    // first, check if plant is already in SiteFarm
    const plantUrl = `${baseUrl}node/plant_database_item?filter[title]=${plant.commonName}`;

    const plantRequest = await fetch(plantUrl);
    const plantData: any = await plantRequest.json();

    if (plantData.data.length > 0) {
      console.log("Plant already in SiteFarm");
      continue;
    }

    const plantTypeIds = lookups.plantTypes.filter((type) =>
      plant.types.includes(type.name)
    );

    const plantTypeData = plant.types.map((type) => ({
      type: "taxonomy_term--pp",
      id: plantTypeIds.find((id) => id.name === type)?.id,
    }));

    const waterUseData = plant.waterUseByRegion.map((waterUse) => ({
      type: "taxonomy_term--pp",
      id: lookups.waterUses.find((item: Lookup) => item.name === waterUse)?.id,
    }));

    // console.log(plantTypeIds, waterUseData);

    const newPlantRequest = {
      data: {
        type: "node--plant_database_item",
        attributes: {
          title: plant.commonName,
          field_botanical_name: plant.botanicalName,
        },
        relationships: {
          field_plant_type: {
            data: plantTypeData,
          },
          field_region_1_water_use: {
            data: waterUseData[0],
          },
          field_region_2_water_use: {
            data: waterUseData[1],
          },
          field_region_3_water_use: {
            data: waterUseData[2],
          },
          field_image: {
            data: [], // thumbnail
          },
          field_images: {
            data: [], // other images
          },
        },
      },
    };

    // console.log('to upload', JSON.stringify(newPlantRequest));

    // upload plant
    const auth =
      "Basic " + Buffer.from(`${apiUser}:${apiPass}`).toString("base64");

    const response = await fetch(
      "https://playground.sf.ucdavis.edu/jsonapi/node/plant_database_item",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.api+json",
          Accept: "application/vnd.api+json",
          Authorization: auth,
        },
        body: JSON.stringify(newPlantRequest),
      }
    );

    if (response.ok && response.status === 201) {
      const responseData = await response.json();
      console.log(responseData);
      plant.uid = responseData.data.id;
    } else {
      console.log("Error uploading plant");
    }

    await transferImages(plant);
  }
};

const uploadImage = async (
  fieldName: string,
  plantUid: string,
  imageUrl: string
) => {
  const auth =
    "Basic " + Buffer.from(`${apiUser}:${apiPass}`).toString("base64");
  // download imageUrl to buffer and upload to SiteFarm as image, then associate with plant
  const imageRequest = await fetch(imageUrl);
  const imageBuffer = await imageRequest.buffer();

  // Step 2: Upload image to SiteFarm
  const uploadRequest = await fetch(
    `https://playground.sf.ucdavis.edu/jsonapi/node/plant_database_item/${plantUid}/${fieldName}`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'file; filename="' + "thumbnail.jpeg" + '"',
        Authorization: auth,
      },
      body: imageBuffer,
    }
  );

  if (uploadRequest.ok) {
    const uploadData = await uploadRequest.json();
    console.log(uploadData);
  } else {
    console.log("Error uploading image");
  }
};

const transferImages = async (plant: Plant) => {
  const thumbnailData = wucols.photos[plant.botanicalName];

  if (thumbnailData) {
    const thumbnailUrl = thumbnailData.small.url;
    await uploadImage("field_image", plant.uid, thumbnailUrl);
  }

  // now upload other images
  if (plant.photoUrls.length > 0) {
    for (let i = 0; i < plant.photoUrls.length; i++) {
      const photoUrl = plant.photoUrls[i];
      await uploadImage("field_images", plant.uid, photoUrl);
    }
  }
};

const run = async () => {
  const lookups = await getLookups();
  const plants = await getPlants();

  await uploadPlants(plants, lookups);
};

run().then().catch();

interface Lookups {
  plantTypes: Lookup[];
  waterUses: Lookup[];
}

interface Lookup {
  id: string;
  name: string;
  val: string;
}

interface Plant {
  uid: string;
  botanicalName: string;
  commonName: string;
  types: string[];
  waterUseByRegion: string[];
  photoUrls: string[];
}

module.exports = {};
