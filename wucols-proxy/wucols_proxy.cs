using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System.Net.Http;
using System.Linq;
using System.Net.Http.Headers;

namespace wucols_proxy
{
    public static class wucols_proxy
    {
        [FunctionName("wucols-proxy")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "wucols-proxy/sites/{someLetter}/files/{someAccountId}/files/{yearAndMonth}/{filename}")]
            HttpRequest req,
            string someLetter,
            string someAccountId,
            string yearAndMonth,
            string filename,
            ILogger log)
        {
            var httpClient = new HttpClient();
            var siteFarmResponse = await httpClient.GetAsync(
                $"https://wucolsplants.sf.ucdavis.edu/sites/{someLetter}/files/{someAccountId}/files/{yearAndMonth}/{filename}");
            var memoryStream = new MemoryStream();
            siteFarmResponse.Content.CopyTo(memoryStream, default, default);
            memoryStream.Position = 0;
            var result = new FileStreamResult(memoryStream, GetMIMEType(filename));
            //log.LogInformation(System.Text.Json.JsonSerializer.Serialize(siteFarmResponse.));

            //, new MediaTypeHeaderValue( siteFarmResponse.Headers.GetValues("Content-Type").FirstOrDefault()));
            //req.HttpContext.Response
            return result;
        }

        private static string GetMIMEType(string fileName)
        {
            var provider =
                new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
            string contentType;
            if (!provider.TryGetContentType(fileName, out contentType))
            {
                contentType = "application/octet-stream";
            }
            return contentType;
        }
    }
}
