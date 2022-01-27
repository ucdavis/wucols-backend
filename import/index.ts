import csv from "csv-parser";
import fs from "fs";
import fetch from "node-fetch";

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

// Step 2: Read all plants from CSV file
const getPlants = async (): Promise<Plant[]> => {
  const plants: any = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream("allPlants.csv")
      .pipe(csv())
      .on("data", (data) =>
        plants.push({
          // something is odd about the first column name, so we need to just iterate keys and use it directly
          botanicalName: data[Object.keys(data)[0]],
          commonName: data["Common Name"],
          types: data["Plant Type(s)"].split(",").map(plantTypeMapper),
          region1: waterUseMapper(data["Region 1"]),
          region2: waterUseMapper(data["Region 2"]),
          region3: waterUseMapper(data["Region 3"]),
          region4: waterUseMapper(data["Region 4"]),
          region5: waterUseMapper(data["Region 5"]),
          region6: waterUseMapper(data["Region 6"]),
          photoRollup: data["Photo Rollup"],
        })
      )
      .on("end", () => {
        // we now have all the plants
        resolve(plants);
      });
  });
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
    (item: Lookup) => item.name === plant.region1
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

  // TODO: upload
};

const run = async () => {
  const lookups = await getLookups();
  const plants = await getPlants();

  uploadPlants(plants, lookups);
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
  region1: string;
  region2: string;
  region3: string;
  region4: string;
  region5: string;
  region6: string;
  photoRollup: string;
}

module.exports = {};
