import fs from "fs";
import fetch from "node-fetch";

const wucols = require("./WUCOLS.json");

const baseUrl = "https://wucolsplants.sf.ucdavis.edu/jsonapi/";
const apiUser = "wucolapi";
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
      return "Not Appropriate For This Region";
    default:
      console.log("Invalid water use:", waterUse);
      throw new Error("Invalid water use");
  }
};

const plantTypeMapper = (plantType: string): string => {
  switch (plantType) {
    case "Ba":
      return "Bamboo";
    case "Bu":
      return "Bulb";
    case "G":
      return "Ornamental Grass";
    case "Gc":
      return "Ground Cover";
    case "P":
      return "Perennial";
    case "Pm":
      return "Palm and Cycad";
    case "S":
      return "Shrub";
    case "Su":
      return "Succulent";
    case "V":
      return "Vine";
    case "N":
      return "California Native";
    case "A":
      return "Arboretum All-Star";
    case "T":
      return "Tree";
    case "":
      return "Unknown";
    default:
      console.log("Invalid plant type:", plantType);
      throw new Error("Invalid plant type");
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
  const plantTypesUrl = baseUrl + "taxonomy_term/plant_type";

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
    commonName: plant.commonName || plant.botanicalName, // if no common name, use botanical name
    culturalInformation: plant.culturalInformation,
    types: plant.types.map(plantTypeMapper),
    waterUseByRegion: plant.waterUseByRegion.map(waterUseMapper),
    photoUrls: plant.photos.map((photo: any) => photo.full.url),
  }));

  return plants;
};

// Step 3: For each plant, upload if not already in SiteFarm
const uploadPlants = async (plants: Plant[], lookups: Lookups) => {
  // For now, only upload subset of plants for testing
  const totalPlants = Math.min(plants.length, 5000);

  for (let i = 1280; i < totalPlants; i++) {
    const plant = plants[i];

    console.log(
      `Uploading plant #${i + 1} ${plant.botanicalName} (${plant.commonName})`
    );
    // console.log(plant);

    // first, check if plant is already in SiteFarm
    const safeBotanicalName = encodeURIComponent(plant.botanicalName);
    const plantUrl = `${baseUrl}node/plant_database_item?filter[field_botanical_name]=${safeBotanicalName}`;

    const plantRequest = await fetch(plantUrl);
    const plantData: any = await plantRequest.json();

    if (plantData.data.length > 0) {
      console.log("Plant already in SiteFarm: " + plant.botanicalName);
      continue;
    }

    const plantTypeIds = lookups.plantTypes.filter((type) =>
      plant.types.includes(type.name)
    );

    const plantTypeData = plant.types.map((type) => ({
      type: "taxonomy_term--plant_type",
      id: plantTypeIds.find((id) => id.name === type)?.id,
    }));

    const waterUseData = plant.waterUseByRegion.map((waterUse) => ({
      type: "taxonomy_term--water_use",
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
          field_region_4_water_use: {
            data: waterUseData[3],
          },
          field_region_5_water_use: {
            data: waterUseData[4],
          },
          field_region_6_water_use: {
            data: waterUseData[5],
          },
          field_thumbnail: {
            data: [], // thumbnail
          },
          field_image_s_: {
            data: [], // other images
          },
        },
      },
    };

    // console.log("to upload", JSON.stringify(newPlantRequest));

    // upload plant
    const auth =
      "Basic " + Buffer.from(`${apiUser}:${apiPass}`).toString("base64");

    const response = await fetch(`${baseUrl}node/plant_database_item`, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
        Authorization: auth,
      },
      body: JSON.stringify(newPlantRequest),
    });

    if (response.ok && response.status === 201) {
      const responseData = await response.json();
      // console.log(responseData);
      plant.uid = responseData.data.id;
    } else {
      console.log("Error uploading plant", response.statusText);
      throw new Error("Error uploading plant " + plant.botanicalName);
    }

    await transferImages(plant);
  }
};

const updateCulturalInformation = async (plants: Plant[]) => {
  const auth =
    "Basic " + Buffer.from(`${apiUser}:${apiPass}`).toString("base64");
  for (let i = 3600; i < plants.length; i++) {
    const plant = plants[i];

    if (!plant.culturalInformation) {
      console.log(
        `No cultural info, skipping plant #${i + 1} ${plant.botanicalName} (${plant.commonName})`
      );
      continue;
    }

    console.log(
      `Updating plant #${i + 1} ${plant.botanicalName} (${plant.commonName})`
    );

    // first, check if plant is already in SiteFarm
    const safeBotanicalName = encodeURIComponent(plant.botanicalName);
    const plantUrl = `${baseUrl}node/plant_database_item?filter[field_botanical_name]=${safeBotanicalName}`;

    const plantRequest = await fetch(plantUrl);
    const plantData: any = await plantRequest.json();

    if (plantData.data.length === 0) {
      console.log("Plant not found in SiteFarm: " + plant.botanicalName);
      continue;
    }

    // we know we have the plant in SiteFarm, so update it
    const plantUid = plantData.data[0].id;

    // field to update is `field_cultural_information`
    const updatePlantRequestData = {
      data: {
        type: "node--plant_database_item",
        id: plantUid,
        attributes: {
          field_cultural_information: plant.culturalInformation,
        },
      },
    };

    const updateRequest = await fetch(
      `${baseUrl}node/plant_database_item/${plantUid}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/vnd.api+json",
          Accept: "application/vnd.api+json",
          Authorization: auth,
        },
        body: JSON.stringify(updatePlantRequestData),
      }
    );

    if (updateRequest.ok) {
      const uploadData = await updateRequest.json();
      // console.log(uploadData);
    } else {
      console.log("Error updating plant " + updateRequest.statusText);
      throw new Error("Error updating plant " + plant.botanicalName);
    }
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
    `${baseUrl}node/plant_database_item/${plantUid}/${fieldName}`,
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
    // console.log(uploadData);
  } else {
    console.log("Error uploading image" + uploadRequest.statusText);
    throw new Error("Error uploading image for plant " + plantUid);
  }
};

const transferImages = async (plant: Plant) => {
  const thumbnailData = wucols.photos[plant.botanicalName];

  if (thumbnailData) {
    const thumbnailUrl = thumbnailData.small.url;
    await uploadImage("field_thumbnail", plant.uid, thumbnailUrl);
  }

  // now upload other images
  if (plant.photoUrls.length > 0) {
    for (let i = 0; i < plant.photoUrls.length; i++) {
      const photoUrl = plant.photoUrls[i];
      await uploadImage("field_image_s_", plant.uid, photoUrl);
    }
  }
};

const run = async () => {
  const lookups = await getLookups();
  const plants = await getPlants();

  console.log(plants.length + " plants found");

  // console.log(lookups);
  // const samplePlant = plants.filter(
  //   (p) => p.botanicalName === "Acacia abyssinica"
  // );

  // console.log(samplePlant);

  await updateCulturalInformation(plants);

  // await uploadPlants(samplePlant, lookups);
  // await uploadPlants(plants, lookups);
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
  culturalInformation: string;
  types: string[];
  waterUseByRegion: string[];
  photoUrls: string[];
}

module.exports = {};
