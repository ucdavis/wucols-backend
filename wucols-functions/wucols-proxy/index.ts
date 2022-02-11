import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import fetch from "node-fetch";

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  const p = req.params;

  const imageRequest = await fetch(
    `https://wucolsplants.sf.ucdavis.edu/sites/${p.someLetter}/files/${p.someAccountId}/files/${p.yearAndMonth}/${p.filename}`
  );
  const imageBuffer = await imageRequest.buffer();

  context.res = {
    status: imageRequest.status,
    body: imageBuffer,
    headers: {
      "content-type": imageRequest.headers.get("content-type"),
      "content-length": imageRequest.headers.get("content-length"),
    },
  };
};

export default httpTrigger;
