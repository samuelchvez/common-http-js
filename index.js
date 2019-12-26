// @flow
import isFunction from 'lodash/isFunction'; // FIXME:
import isEmptyObject from 'is-empty-object';

import HTTP_STATUS, * as fromStatus from './HTTPStatus';
import HTTPError from './HTTPError';


type URLParamsType = {[string]: string};
type MockType = {
  response: {
    statusCode: number,
    body: any
  },
  delay: number
};
type FetchPromiseResponseType = Promise<any>;
type PostType = {
  url: string,
  data: URLParamsType,
  headers?: URLParamsType,
  files?: Object,
  mock?: MockType
};
type PutType = PostType;
type PatchType = PostType;
type GetType = {
  url: string,
  headers?: URLParamsType,
  mock?: MockType
};
type DelType = GetType;

type RequestUrlPartParams = {
  urlPartParams: URLParamsType
};
type RequestHeadersType = {
  headers: URLParamsType
};
type RequestTokenType = {
  token?: string
};
type RequestMockType = {
  mock?: MockType
};
type RequestCommonType =
  & RequestTokenType
  & RequestHeadersType
  & RequestUrlPartParams
  & RequestMockType;
type FileRequestCommonType = {
  files: Object
} & RequestCommonType;
type ResourceListType = {
  filters: URLParamsType,
  headers: URLParamsType,
  token?: string,
  mock?: MockType
};
type DetailResourceType = {
  id: number
} & RequestCommonType;
type UpdateResourceType = {
  id: number,
  data: URLParamsType,
} & FileRequestCommonType;
type ReplaceResourceType = {
  id: number,
  data: URLParamsType,
} & FileRequestCommonType;
type CreateResourceType = {
  data: URLParamsType
} & FileRequestCommonType;
type CustomMethodType = {
  data: URLParamsType,
  filters: URLParamsType
} & FileRequestCommonType;
type CustomDetailMethodType = {
  id: number,
  filters: URLParamsType,
  data: URLParamsType
} & FileRequestCommonType;


export const delay = (time: number):Promise<mixed> => {
  if (time <= 0) {
    return Promise.resolve({});
  }

  return new Promise(
    resolve => setTimeout(resolve, time),
  );
};

export const toQuery = (params: URLParamsType): string => Object.keys(
  params,
).filter(key => typeof params[key] !== 'undefined').map(
  value => `${value}=${params[value]}`,
)
  .join('&');

const primaryResponseHandler = (response: Response): Promise<mixed> => {
  const { headers, status } = response || {};
  const statusCode = status;
  const contentTypes = headers.get('content-type').split(';').map(contentType => contentType);

  if (fromStatus.isSuccessful(statusCode)) {
    // No body
    if (status === HTTP_STATUS.NO_CONTENT) {
      return Promise.resolve({});
    }

    // Theorically server returned a JSON
    if (contentTypes.includes('application/json')) {
      return response.json().catch(() => {
        response.text().then((data) => {
          throw new HTTPError({
            statusCode,
            data,
            meta: 'Server returned success, but an error occurred while parsing JSON response',
          });
        });
      });
    }

    return response.text().then(result => ({
      text: result,
      response,
    }));
  }

  // Error
  if (fromStatus.isError(statusCode)) {
    if (contentTypes.includes('application/json')) {
      return response.json()
        .catch(() => {
          response.text().then((data) => {
            throw new HTTPError({
              statusCode,
              data,
              meta: 'Server returned a JSON error response, but an error occurred while parsing it',
            });
          });
        })
        .then((data) => {
          throw new HTTPError({
            statusCode,
            data,
            meta: 'Server returned a JSON error response',
          });
        });
    }

    return response.text()
      .then((data) => {
        throw new HTTPError({
          statusCode,
          data,
          meta: 'Server returned a PLAIN error response',
        });
      });
  }

  // TODO: don't know how to handle 1xx and 3xx responses :(
  return Promise.resolve({});
};

export const throwTimeout = (location: string) => {
  throw new HTTPError({
    statusCode: HTTP_STATUS.GATEWAY_TIMEOUT,
    data: { location },
    meta: 'Server did not respond, the data from this error is synthetic',
  });
};

type CallType = {
  url: string,
  method: string,
  data?: URLParamsType,
  headers?: URLParamsType,
  // files?: Object,
  mock?: MockType
};

const call = ({
  url,
  method,
  data,
  headers,
  // files,
  mock,
}: CallType): Promise<mixed> => {
  if (typeof mock !== 'undefined') {
    const { response: { statusCode, body } } = mock;
    return delay(mock.delay).then(() => {
      if (fromStatus.isSuccessful(statusCode)) {
        // No body
        if (statusCode === HTTP_STATUS.NO_CONTENT) {
          return Promise.resolve({});
        }

        return Promise.resolve(body);
      }

      throw new HTTPError({
        statusCode,
        data: body,
        meta: 'Server returned a JSON error',
      });
    });
  }

  const request = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    } || {},
    body: undefined,
  };

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    if (typeof data !== 'undefined') {
      request.body = JSON.stringify(data);
    }

    // if(typeof files !== 'undefined') {
    //   const fData = new FormData();
    //   Object.keys(files).forEach(key => {
    //     if(typeof files !== 'undefined') {
    //       fData.append(key, files[key]);

    //     }
    //   });
    //   request.body = fData;
    //   delete request.headers['Content-Type'];
    // }
  }

  return fetch(url, request)
    .catch(throwTimeout)
    .then(primaryResponseHandler);
};

export const post = ({
  url,
  data,
  headers,
  files,
  mock,
}: PostType): FetchPromiseResponseType => call({
  url,
  method: 'POST',
  data,
  headers,
  files,
  mock,
});

export const put = ({
  url,
  data,
  headers,
  files,
  mock,
}: PutType): FetchPromiseResponseType => call({
  url,
  method: 'PUT',
  data,
  headers,
  files,
  mock,
});

export const patch = ({
  url,
  data,
  headers,
  files,
  mock,
}: PatchType): FetchPromiseResponseType => call({
  url,
  method: 'PATCH',
  data,
  headers,
  files,
  mock,
});

export const get = ({
  url,
  headers,
  mock,
}: GetType): FetchPromiseResponseType => call({
  url,
  method: 'GET',
  headers,
  mock,
});

export const del = ({
  url,
  headers,
  mock,
}: DelType): FetchPromiseResponseType => call({
  url,
  method: 'DELETE',
  headers,
  mock,
});

export class RESTfulAPI {
  url: string;

  prefix: ?string;

  dev: boolean;

  constructor(url: string, prefix: ?string, dev: boolean) {
    this.url = url;
    this.prefix = prefix;
    this.dev = dev;
  }

  isInDevMode() {
    return this.dev;
  }

  getURL(route: string, params: URLParamsType = {}, appendSlash: boolean = true) {
    const base = `${
      this.url
    }${
      this.prefix != null ? `/${this.prefix}/` : '/'
    }${
      route
    }${
      appendSlash ? '/' : ''
    }`;

    if (!isEmptyObject(params)) {
      return `${base}?${toQuery(params)}`;
    }

    return base;
  }
}

type ResourceConstructorType = {
  name: string,
  api: RESTfulAPI,
  headerKey?: string,
  headerPrefix?: string,
  customization?: {[string]: {
    method: string,
    urlPart: string | (params: Object) => string,
    isDetail: boolean
  }}
};

export class Resource {
  api: RESTfulAPI;

  name: string;

  custom: {[string]: any => Promise<mixed>};

  getAuthHeaders: (URLParamsType, ?string) => URLParamsType;

  handleRequest(
    url: string,
    pUrl: string,
    method: string,
    data: URLParamsType,
    headers: URLParamsType,
    files: Object,
    mock?: MockType,
  ) {
    const rMock = this.api.isInDevMode() ? mock : undefined;
    switch (method) {
      case 'POST':
        return post({
          url,
          data,
          headers,
          files,
          mock: rMock,
        });
      case 'DELETE':
        return del({
          url: pUrl,
          headers,
          mock: rMock,
        });
      case 'PUT':
        return put({
          url,
          data,
          headers,
          files,
          mock: rMock,
        });
      case 'PATCH':
        return patch({
          url,
          data,
          headers,
          files,
          mock: rMock,
        });
      default:
        return get({
          url: pUrl,
          headers,
          mock: rMock,
        });
    }
  }

  constructor({
    name,
    api,
    headerKey = 'Authorization',
    headerPrefix = 'JWT',
    customization = {},
  }: ResourceConstructorType) {
    this.api = api;
    this.name = name;
    this.custom = {};

    this.getAuthHeaders = (headers, token) => (token !== null && typeof token !== 'undefined' ? ({
      ...headers,
      [headerKey]: `${headerPrefix} ${token}`,
    }) : headers);

    Object.keys(customization).forEach((key) => {
      const { method, urlPart, isDetail } = customization[key];

      if (isDetail) {
        this.custom[key] = ({
          id,
          filters = {},
          data = {},
          headers = {},
          token,
          files = {},
          urlPartParams = {},
          mock,
        }: CustomDetailMethodType) => {
          let strUrlPart = '';
          if (typeof urlPart === 'string') {
            strUrlPart = urlPart;
          } else if (isFunction(urlPart)) {
            strUrlPart = urlPart(urlPartParams);
          }
          const url = this.api.getURL(`${this.name}/${id}/${strUrlPart}`);
          const pUrl = this.api.getURL(`${this.name}/${id}/${strUrlPart}`, filters);

          return this.handleRequest(
            url,
            pUrl,
            method,
            data,
            this.getAuthHeaders(headers, token),
            files,
            mock,
          );
        };
      } else {
        this.custom[key] = ({
          filters = {},
          data = {},
          headers = {},
          token,
          files = {},
          urlPartParams = {},
          mock,
        }: CustomMethodType) => {
          let strUrlPart = '';
          if (typeof urlPart === 'string') {
            strUrlPart = urlPart;
          } else if (isFunction(urlPart)) {
            strUrlPart = urlPart(urlPartParams);
          }

          const url = this.api.getURL(`${this.name}/${strUrlPart}`);
          const pUrl = this.api.getURL(`${this.name}/${strUrlPart}`, filters);
          return this.handleRequest(
            url,
            pUrl,
            method,
            data,
            this.getAuthHeaders(headers, token),
            files,
            mock,
          );
        };
      }
    });
  }

  list({
    filters,
    headers = {},
    token,
    mock,
  }: ResourceListType) {
    return get({
      url: this.api.getURL(this.name, filters),
      headers: this.getAuthHeaders(headers, token),
      mock: this.api.isInDevMode() ? mock : undefined,
    });
  }

  create({
    data,
    headers = {},
    files = {},
    token,
    mock,
  }: CreateResourceType) {
    return post({
      url: this.api.getURL(this.name),
      data,
      headers: this.getAuthHeaders(headers, token),
      files,
      mock: this.api.isInDevMode() ? mock : undefined,
    });
  }

  detail({
    id,
    headers = {},
    token,
    mock,
  }: DetailResourceType) {
    return get({
      url: this.api.getURL(`${this.name}/${id}`),
      headers: this.getAuthHeaders(headers, token),
      mock: this.api.isInDevMode() ? mock : undefined,
    });
  }

  update({
    id,
    data = {},
    headers = {},
    files = {},
    token,
    mock,
  }: UpdateResourceType) {
    return patch({
      url: this.api.getURL(`${this.name}/${id}`),
      data,
      headers: this.getAuthHeaders(headers, token),
      files,
      mock: this.api.isInDevMode() ? mock : undefined,
    });
  }

  replace({
    id,
    data = {},
    headers = {},
    files = {},
    token,
    mock,
  }: ReplaceResourceType) {
    return put({
      url: this.api.getURL(`${this.name}/${id}`),
      data,
      headers: this.getAuthHeaders(headers, token),
      files,
      mock: this.api.isInDevMode() ? mock : undefined,
    });
  }

  remove({
    id,
    headers = {},
    token,
    mock,
  }: DetailResourceType) {
    return del({
      url: this.api.getURL(`${this.name}/${id}`),
      headers: this.getAuthHeaders(headers, token),
      mock: this.api.isInDevMode() ? mock : undefined,
    });
  }
}
