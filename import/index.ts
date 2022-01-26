import csv from "csv-parser";
import fs from "fs";
import fetch from "node-fetch";

const baseUrl = "https://playground.sf.ucdavis.edu/jsonapi/";

// Step 1: Read out SiteFarm plant type and water use lookups
const getLookups = async (): Promise<any> => {
  const plantTypesUrl = baseUrl + "taxonomy_term/water_use";

  const waterUse = await fetch(plantTypesUrl);
  const waterUseData: any = await waterUse.json();

  const plantTypes = waterUseData.data.map((item: any) => {
    return {
      id: item.id,
      name: item.attributes.name,
    };
  });

  console.log(plantTypes);
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
          type: data["Plant Type(s)"],
          region1: data["Region 1"],
          region2: data["Region 2"],
          region3: data["Region 3"],
          region4: data["Region 4"],
          region5: data["Region 5"],
          region6: data["Region 6"],
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

getLookups().then().catch();

interface Plant {
  botanicalName: string;
  botanicalName2: string;
  commonName: string;
  type: string;
  region1: string;
  region2: string;
  region3: string;
  region4: string;
  region5: string;
  region6: string;
  photoRollup: string;
}

module.exports = {};