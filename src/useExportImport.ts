import { ref } from "vue";
import { useStores, useApi } from "@directus/extensions-sdk";
import { getEndpoint } from "@directus/utils";
import { getPublicURL } from "./utils";
import { utilsImport } from "@directus/sdk";

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

    const dataBlob = await fetch(exportUrl).then((data) => data.blob());
    const file = new File([dataBlob], collectionName, {
      type: 'application/json',
    });

    return file;
  };

  const uploadFile = async (collectionName: string, file: File, remoteClient: any) => {
    console.log(remoteClient);
    uploading.value = true;
    importing.value = false;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const importRequest = await remoteClient.request(utilsImport(collectionName, formData));

      notificationsStore.add({
        title: `Data successfully imported from ${file.name}`,
      });
    } catch (err: any) {
      console.error(err);
      const code = err?.response?.data?.errors?.[0]?.extensions?.code;

      notificationsStore.add({
        title: code,
        type: 'error',
      });
    } finally {
      uploading.value = false;
      importing.value = false;
    }
  };

  return { uploading, importing, uploadFile, exportData };
};