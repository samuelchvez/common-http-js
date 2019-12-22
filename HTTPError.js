// @flow
import isPlainObject from 'lodash/isPlainObject';

import { HTTP_STATUS_DESCRIPTIONS } from './HTTPStatus';


type HTTPErrorParamTypes = {
  statusCode: number,
  data?: any,
  meta?: string
};

class HTTPError extends Error {
  statusCode: number;

  isPlain: boolean;

  data: Object | string;

  meta: string;

  constructor({
    statusCode,
    data = {},
    meta = '',
  }: HTTPErrorParamTypes) {
    super(HTTP_STATUS_DESCRIPTIONS[statusCode] || `Unidentified error status code ${statusCode}`);

    this.statusCode = statusCode;
    this.isPlain = true;
    this.data = `${data}`;
    if (isPlainObject(data)) {
      this.isPlain = false;
      this.data = data;
    }

    this.meta = meta;
  }
}

export default HTTPError;
