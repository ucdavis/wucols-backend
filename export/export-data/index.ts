import { AzureFunction, Context } from "@azure/functions";
import { getData } from "./get-data";

const exportWucolsData: AzureFunction = async function (
  context: Context,
  myTimer: any
): Promise<void> {
  context.log("Timer trigger function ran!", new Date().toISOString());
  const data = await getData();
  context.log(JSON.stringify(data));
};

export default exportWucolsData;
