import { AzureFunction, Context } from "@azure/functions";
import {
  BlobItem,
  BlobServiceClient,
  BlockBlobClient,
  ContainerClient,
} from "@azure/storage-blob";
import { getData as getSiteFarmData } from "./get-data";
import { Data, WucolsBlobLink as WucolsDataLink } from "./types";

const exportWucolsData: AzureFunction = async function (
  context: Context,
  myTimer: any
): Promise<void> {
  const timestamp = new Date().toISOString();

  context.log("wucols-export starting ", timestamp);

  let dataNeedsRefresh = false;

  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AzureWebJobsStorage || ""
  );
  const containerClient = blobServiceClient.getContainerClient("wucols-export");

  const dataLinkClient = await containerClient.getBlockBlobClient(
    "meta/wucols-data.json"
  );

  const latestBlobClient = await getBlobClientForLatestDataBlob(
    containerClient,
    timestamp,
    context
  );

  const siteFarmData = JSON.stringify(await getSiteFarmData(context));
  context.log("SiteFarm data fetched. Length: ", siteFarmData.length);

  if (!(await dataLinkClient.exists()) || !(await latestBlobClient.exists())) {
    context.log("Data blob does not exist.");
    dataNeedsRefresh = true;
  } else {
    const latestData = JSON.stringify(
      await downloadBlob<Data>(latestBlobClient)
    );
    const dataLink = await downloadBlob<WucolsDataLink>(dataLinkClient);
    if (dataLink.cachedBlobUrl !== latestBlobClient.url) {
      context.log("Latest data blob url does not match data link.");
      dataNeedsRefresh = true;
    }
    if (siteFarmData !== latestData) {
      context.log("Latest blob data does not match SiteFarm data.");
      dataNeedsRefresh = true;
    }
  }

  if (dataNeedsRefresh) {
    const newBlobClient = containerClient.getBlockBlobClient(
      `data/wucols.${timestamp}.json`
    );
    const dataLink = {
      cachedBlobUrl: newBlobClient.url,
    } as WucolsDataLink;
    context.log("Uploading new data blob.");
    await uploadData(siteFarmData, newBlobClient);
    context.log("Refreshing data link.");
    await uploadDataLink(dataLink, dataLinkClient);
  } else {
    context.log("Blob data is up to date.");
  }
};

async function getBlobClientForLatestDataBlob(
  containerClient: ContainerClient,
  timestamp: string,
  context: Context
): Promise<BlockBlobClient> {
  // pull all BlomItems in order to sort/filter locally
  const blobItems: BlobItem[] = [];
  for await (const blobItem of containerClient.listBlobsFlat()) {
    if (blobItem.name.startsWith("data/wucols.")) {
      blobItems.push(blobItem);
    }
  }

  const latestBlobItem = blobItems.sort((a, b) => {
    const aDate = new Date(a.properties.lastModified);
    const bDate = new Date(b.properties.lastModified);
    return bDate.getTime() - aDate.getTime();
  })[0];

  if (!latestBlobItem) {
    return containerClient.getBlockBlobClient(`data/wucols.${timestamp}.json`);
  }

  return containerClient.getBlockBlobClient(latestBlobItem.name);
}

async function uploadDataLink(
  dataLink: WucolsDataLink,
  dataLinkClient: BlockBlobClient
): Promise<void> {
  const body = JSON.stringify(dataLink);
  await dataLinkClient.upload(body, body.length, {
    blobHTTPHeaders: {
      blobContentType: "application/json",
      blobContentDisposition: `filename=wucols-data.json`,
      blobCacheControl: "no-store",
    },
  });
}

async function uploadData(
  blobData: string,
  dataClient: BlockBlobClient
): Promise<void> {
  const body = blobData;
  const filename = dataClient.name.substring(
    dataClient.name.lastIndexOf("/") + 1
  );
  const secondsPerYear = 365 * 24 * 60 * 60;
  await dataClient.upload(body, body.length, {
    blobHTTPHeaders: {
      blobContentType: "application/json",
      blobContentDisposition: `filename=${filename}`,
      blobCacheControl: `max-age=${secondsPerYear}`,
    },
  });
}

async function downloadBlob<T>(blobClient: BlockBlobClient): Promise<T> {
  const buffer = await blobClient.downloadToBuffer();
  return JSON.parse(buffer.toString()) as T;
}

export default exportWucolsData;
