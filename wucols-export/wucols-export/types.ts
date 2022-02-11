export interface DataLookups {
  regions: Region[];
  plantTypes: PlantType[];
  waterUseClassifications: WaterUseClassification[];
  cities: City[];
  benchCardTemplates: BenchCardTemplate[];
}

export interface Data extends DataLookups {
  plants: Plant[];
  photos: { [key: string]: Photo };
}

export interface Region {
  id: number;
  name: string;
}

export interface PlantType {
  code: string;
  name: string;
}

export interface WaterUseClassification {
  code: WaterUseCode;
  name: string;
  plantFactor: string;
  percentageET0: string;
}

export interface City {
  region: number;
  name: string;
  id: number;
  position: Coordinates;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BenchCardTemplate {
  name: string;
  id: string;
  sizeInInches: Point;
}

export interface Point {
  x: number;
  y: number;
}

export interface Plant {
  id: number;
  url_keyword: string;
  botanicalName: string;
  photos: Photo[];
  commonName: string;
  types: string[];
  culturalInformation: string;
  waterUseByRegion: WaterUseCode[]; // number of elements is the number of regions
}

export type WaterUseCode = "VL" | "LO" | "M" | "H" | "U" | "NA";

export interface Photo {
  small: PhotoReference;
  // large: PhotoReference;
  // full: PhotoReference;
  filename: string;
  caption: string;
}

export interface PhotoReference {
  url: string;
  width: number;
  height: number;
}

export interface WucolsBlobLink {
  cachedBlobUrl: string;
}
