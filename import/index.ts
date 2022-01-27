import fs from "fs";
import fetch from "node-fetch";

const wucols = require("./WUCOLS.json");

const baseUrl = "https://playground.sf.ucdavis.edu/jsonapi/";

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
      return "Unknown";
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
      return "T (Tree)"; // TODO: remove after testing, throw instead
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
  }));

  return plants;
};

// Step 3: For each plant, upload if not already in SiteFarm
const uploadPlants = async (plants: Plant[], lookups: Lookups) => {
  // TODO: loop through all plants
  const plant = plants[0];

  console.log(plant);

  const plantTypeIds = lookups.plantTypes.filter((type) =>
    plant.types.includes(type.name)
  );

  const waterUse1 = lookups.waterUses.find(
    (item: Lookup) => item.name === plant.waterUseByRegion[0]
  );

  console.log(plantTypeIds, waterUse1);

  const newPlantRequest = {
    data: {
      type: "node--plant_database_item",
      attributes: {
        title: plant.commonName,
        field_botanical_name: plant.botanicalName,
      },
      relationships: {
        field_plant_type: {
          data: [
            {
              type: "taxonomy_term--pp",
              id: "e8b3a6f9-b90c-4135-8ba1-1b0471091897",
            },
            {
              type: "taxonomy_term--pp",
              id: "13bb0e90-c52e-46d3-a5f4-a6c0ccf42dd2",
            },
          ],
        },
        field_region_1_water_use: {
          data: {
            type: "taxonomy_term--water_use",
            id: "c493d494-9011-47dc-b272-b3d8a3bc0de6",
          },
        },
        field_region_2_water_use: {
          data: {
            type: "taxonomy_term--water_use",
            id: "c493d494-9011-47dc-b272-b3d8a3bc0de6",
          },
        },
        field_region_3_water_use: {
          data: {
            type: "taxonomy_term--water_use",
            id: "c493d494-9011-47dc-b272-b3d8a3bc0de6",
          },
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

  // upload plant
  // TODO: move to config
  const user = "apiuser2";
  const pass = "mJmUViZ80wv2oYZhEZD7fsWbj1FB";
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");

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
  } else {
    console.log("Error uploading plant");
  }

  // TODO: upload images for plant
  // TODO: grab images from photoRollup and figure out thumbnails
};

const transferImage = async (plant: Plant, imageUrl: string) => {
  // TODO: For now we are just sticking a sample image on our sample plant
  const user = "apiuser2";
  const pass = "mJmUViZ80wv2oYZhEZD7fsWbj1FB";
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const plantId = "e0c10b41-ee1f-43fd-919e-717569b41286"; // TODO: get plant id from SiteFarm
  // download imageUrl to buffer and upload to SiteFarm as image, then associate with plant

  // Step 1: Download image
  const imageRequest = await fetch(imageUrl);
  const imageBuffer = await imageRequest.buffer();

  // Step 2: Upload image to SiteFarm
  const uploadRequest = await fetch(
    `https://playground.sf.ucdavis.edu/jsonapi/node/plant_database_item/${plantId}/field_images`,
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

const run = async () => {
  // const lookups = await getLookups();
  const plants = await getPlants();

  console.log(plants[0]);
  // // uploadPlants(plants, lookups);
  // await transferImage(
  //   plants[0],
  //   "https://dl.airtable.com/.attachmentThumbnails/312dd293b4cc48c0fb71f0a6ba513b2d/2559d293" // random thumbnail
  // );
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
  botanicalName: string;
  commonName: string;
  types: string[];
  waterUseByRegion: string[];
}

module.exports = {};
