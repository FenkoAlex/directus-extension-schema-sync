import { cloneDeep } from 'lodash';
import type { Collection } from './types';

export function createJsonFile(data: JSON, name: string = '') {
  const str = JSON.stringify(data);
  const bytes = new TextEncoder().encode(str);
  const blob = new Blob([bytes], {
    type: "application/json;charset=utf-8"
  });

  const file = new File([blob], name, {
    type: 'application/json',
  });

  return file;
}
export const logMessageTypes = {
  error: 'Error',
  success: 'Success'
}
export function createLogMessage(type: string, message: string) {
  const time = new Date();
  return `${time.getHours()}:${time.getMinutes()}:${time.getSeconds()} ${type}: ${message}
  `;
}

export function recordFromCollectionabl(arr: { collection: string }[]) {
  return arr.reduce<Record<string, any>>((acc, val) => {
    acc[val.collection] = {
      ...val,
    };

    return acc;
  }, {});
}

export function mapFromCollectionabl(arr: { collection: string }[]) {
  const result = new Map();

  arr.forEach((element) => {
    const tmpArr = result.get(element.collection);
    if (tmpArr) {
      tmpArr.push(element);
      result.set(element.collection, tmpArr);
    } else {
      result.set(element.collection, [element]);
    }
  });

  return result;
}

export const relationFieldType: Record<string, string> = {
  o2o: 'o2o',
  o2m: 'o2m',
  m2o: 'm2o',
  m2m: 'm2m',
  m2a: 'm2a',
};

export function getRelationFields(
  fieldsMap: Map<string, any>,
  collectionName: string
) {
  const result: string[] = [];

  if (!fieldsMap.has(collectionName)) {
    return result;
  }

  console.log('fieldsMap', fieldsMap.get(collectionName));
  for (let collection of fieldsMap.get(collectionName)) {
    console.log(collection.field, collection.meta.special?.[0], 'relationFieldType', Boolean(relationFieldType[collection.meta.special?.[0] || '']) || (collection.type === "uuid" && collection.field !== 'id'));
    if (Boolean(relationFieldType[collection.meta.special?.[0] || '']) || (collection.type === "uuid" && collection.field !== 'id')) {
      console.log('push', collection.field)
      result.push(collection.field);
    }
  }

  return result;
}

export function removeFields(data: any[], fields: string[]) {
  const tmpData = cloneDeep(data);
  for (let item of tmpData) {
    for (let key of fields) {
      if (item[key]) {
        item[key] = null;
      }
    }
  }

  return tmpData;
}

export const splitCollections = (collections: Collection[]) => {
  const userCollections: Collection[] = [];
  const systemCollections: Collection[] = [];

  for (let collection of collections) {
    if (Boolean(collection.meta?.system)) {
      systemCollections.push(collection);
    } else {
      userCollections.push(collection);
    }
  }

  return { userCollections, systemCollections };
};

/**
 * Get the full API root URL from the current page href
 */
export function getPublicURL(): string {
  return extract(window.location.href);
}

/**
 * Extract the root path of the admin app from a given input path/url
 *
 * @param path - Path or URL string of the current page
 * @returns - Root URL of the Directus instance
 */
export function extract(path: string) {
  const parts = path.split("/");
  const adminIndex = parts.indexOf("admin");
  const rootPath = parts.slice(0, adminIndex).join("/") + "/";
  return rootPath;
}
