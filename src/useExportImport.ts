import { ref } from "vue";
import { useStores, useApi } from "@directus/extensions-sdk";
import { getEndpoint } from "@directus/utils";
import { getPublicURL } from "./utils";
import { utilsImport, updateCollection } from "@directus/sdk";

export const useExportImport = () => {
  const api = useApi();
  const uploading = ref(false);
  const importing = ref(false);
  const { useNotificationsStore } = useStores();
  const notificationsStore = useNotificationsStore();

  const exportData = async (collectionName: string, currentClient?: any) => {
    const endpoint = getEndpoint(collectionName);

    // usually getEndpoint contains leading slash, but here we need to remove it
    const url = getPublicURL() + endpoint.substring(1);

    const params: Record<string, unknown> = {
      access_token: (
        api.defaults.headers.common["Authorization"] as string
      ).substring(7),
      limit: -1,
      export: "json",
    };

    // if (exportSettings.sort && exportSettings.sort !== '') params.sort = exportSettings.sort;
    // if (exportSettings.fields) params.fields = exportSettings.fields;
    // if (exportSettings.search) params.search = exportSettings.search;
    // if (exportSettings.filter) params.filter = exportSettings.filter;
    // if (exportSettings.search) params.search = exportSettings.search;
    // params.limit = exportSettings.limit ? Math.min(exportSettings.limit, queryLimitMax) : -1;

    const exportUrl = api.getUri({
      url,
      params,
    });

    return await fetch(exportUrl).then((data) => data.json());
  };

  const uploadFile = async (collectionName: string, file: File, remoteClient: any) => {
    uploading.value = true;
    importing.value = false;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await remoteClient.request(utilsImport(collectionName, formData));
    } finally {
      uploading.value = false;
      importing.value = false;
    }
  };

  const updateSyncDate = async (collectionName: string, remoteClient: any) => {
    const collectionObject = {
      meta: {
        imported_at: new Date(),
      },
    };
    await remoteClient.request(updateCollection(collectionName, collectionObject as any));
  };

  return { uploading, importing, uploadFile, exportData, updateSyncDate };
};