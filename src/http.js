import { Observable } from "rxjs";

const XSSI_PREFIX = /^\)\]\}',?\n/;

function getResponseUrl(xhr) {
  if ("responseURL" in xhr && xhr.responseURL) {
    return xhr.responseURL;
  }
  if (/^X-Request-URL:/m.test(xhr.getAllResponseHeaders())) {
    return xhr.getResponseHeader("X-Request-URL");
  }
  return null;
}

export function handle({
  url,
  method,
  headers,
  serializeBody,
  responseType,
  withCredentials
}) {
  return new Observable(observer => {
    let xhr = new XMLHttpRequest();

    const reqBody = serializeBody();

    xhr.open(method, url);

    xhr.responseType = responseType.toLowerCase() || "json";

    xhr.withCredentials = !!withCredentials;

    const onLoad = () => {
      let status = xhr.status === 1223 ? 204 : xhr.status;
      const statusText = xhr.statusText || "OK";

      // The body will be read out if present.
      let body = null;

      if (status !== 204) {
        // Use XMLHttpRequest.response if set, responseText otherwise.
        body =
          typeof xhr.response === "undefined" ? xhr.responseText : xhr.response;
      }

      // Normalize another potential bug (this one comes from CORS).
      if (status === 0) {
        status = !!body ? 200 : 0;
      }

      let ok = status >= 200 && status < 300;

      // Check whether the body needs to be parsed as JSON (in many cases the browser
      // will have done that already).
      if (responseType === "json" && typeof body === "string") {
        // Save the original body, before attempting XSSI prefix stripping.
        const originalBody = body;
        body = body.replace(XSSI_PREFIX, "");
        try {
          // Attempt the parse. If it fails, a parse error should be delivered to the user.
          body = body !== "" ? JSON.parse(body) : null;
        } catch (error) {
          // Since the JSON.parse failed, it's reasonable to assume this might not have been a
          // JSON response. Restore the original body (including any XSSI prefix) to deliver
          // a better error response.
          body = originalBody;

          // If this was an error request to begin with, leave it as a string, it probably
          // just isn't JSON. Otherwise, deliver the parsing error to the user.
          if (ok) {
            // Even though the response status was 2xx, this is still an error.
            ok = false;
            // The parse error contains the text of the body that failed to parse.
            body = { error, text: body };
          }
        }
      }

      if (ok) {
        observer.next({
          body,
          headers,
          status,
          url: getResponseUrl(xhr) || url || undefined,
          statusText
        });
        // The full body has been received and delivered, no further events
        // are possible. This request is complete.
        observer.complete();
      } else {
        observer.error({
          // The error in this case is the response body (error from the server).
          error: body,
          headers,
          status,
          url: getResponseUrl(xhr) || url || undefined,
          statusText
        });
      }
    };

    const onError = error => {
      observer.error({
        error,
        status: xhr.status || 0,
        statusText: xhr.statusText || "Unknown Error",
        url: url || undefined
      });
    };

    xhr.addEventListener("load", onLoad);
    xhr.addEventListener("error", onError);

    xhr.send(reqBody);

    return () => {
      xhr.removeEventListener("error", onError);
      xhr.removeEventListener("load", onLoad);

      xhr.abort();
    };
  });
}

const DEFAULT_PARAMS = {
  withCredentials: false,
  responseType: "json",
  headers: new Map()
};

export function get(
  url,
  { headers, responseType, withCredentials } = DEFAULT_PARAMS
) {
  return handle({
    method: "get",
    withCredentials,
    serializeBody: () => null,
    url,
    headers,
    responseType
  });
}

export function post(
  url,
  body,
  { headers, responseType, withCredentials } = DEFAULT_PARAMS
) {
  return handle({
    method: "post",
    withCredentials,
    serializeBody: () => JSON.stringify(body),
    url,
    headers,
    responseType
  });
}
