using System;
using System.IO;
using System.Net.Http;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.StaticFiles;

namespace wucols_proxy
{
    public class WucolsProxyFunction
    {
        private readonly ILogger<WucolsProxyFunction> _logger;
        private readonly HttpClient _httpClient;

        public WucolsProxyFunction(ILogger<WucolsProxyFunction> logger, HttpClient httpClient)
        {
            _logger = logger;
            _httpClient = httpClient;
        }

        [Function("wucols-proxy")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "sites/{someLetter}/files/{someAccountId}/files/{yearAndMonth}/{filename}")]
            HttpRequestData req,
            string someLetter,
            string someAccountId,
            string yearAndMonth,
            string filename)
        {
            try
            {
                _logger.LogInformation("Processing request for: {someLetter}/{someAccountId}/{yearAndMonth}/{filename}", 
                    someLetter, someAccountId, yearAndMonth, filename);

                var targetUrl = $"https://wucolsplants.sf.ucdavis.edu/sites/{someLetter}/files/{someAccountId}/files/{yearAndMonth}/{filename}";
                _logger.LogInformation("Fetching from: {targetUrl}", targetUrl);

                var siteFarmResponse = await _httpClient.GetAsync(targetUrl);

                var response = req.CreateResponse();
                
                if (siteFarmResponse.IsSuccessStatusCode)
                {
                    var content = await siteFarmResponse.Content.ReadAsByteArrayAsync();
                    var contentType = GetMIMEType(filename);
                    
                    _logger.LogInformation("Successfully retrieved {byteCount} bytes with content type: {contentType}", 
                        content.Length, contentType);
                    
                    response.StatusCode = System.Net.HttpStatusCode.OK;
                    response.Headers.Add("Content-Type", contentType);
                    response.WriteBytes(content);
                }
                else
                {
                    _logger.LogWarning("Source returned status code: {statusCode}", siteFarmResponse.StatusCode);
                    response.StatusCode = siteFarmResponse.StatusCode;
                }

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing request for file: {filename}", filename);
                var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
                return errorResponse;
            }
        }

        private static string GetMIMEType(string fileName)
        {
            var provider = new FileExtensionContentTypeProvider();
            if (!provider.TryGetContentType(fileName, out string? contentType))
            {
                contentType = "application/octet-stream";
            }
            return contentType;
        }
    }
}
