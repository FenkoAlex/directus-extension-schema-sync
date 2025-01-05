<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useApi, useStores } from "@directus/extensions-sdk";
import { debounce } from "lodash";
import { readFiles, updateFile } from "@directus/sdk";
import { format } from "date-fns";

import { initDirectusClients } from "./init-directus-clients";
import Nav from "./nav.vue";
import { nav } from "./path";
import { blobToBase64, getPublicURL } from "./utils";

const FILES_PER_PAGE = 50;
const TABLE_HEADER = [
  { text: "ID", value: "id" },
  { text: "", value: "img", width: "300" },
  { text: "Title", value: "title", width: "450" },
  { text: "Modified on", value: "modified_on", width: "250" },
  { text: "Modified by", value: "modified_by", width: "250" },
];

type AssetFile = ReturnType<typeof readFiles> & {
  fileBlob: Blob;
  fileBase64: string;
};

const { useNotificationsStore } = useStores();
const notificationsStore = useNotificationsStore();

const api = useApi();
const loading = ref(true);
const selected = ref([] as AssetFile[]);
const clientA = ref<any>(null);
const clientB = ref<any>(null);

const search = ref<string | null>(null);
const files = ref({});
const filesCount = ref(0);
const paginationState = computed(() => {
  return {
    length: Math.ceil(filesCount.value / FILES_PER_PAGE),
    totalVisible: 10,
  };
});
const currentPage = ref(1);

async function loadFile(file) {
  const fileBlob = await getAsset(file.id);
  const fileBase64 = fileBlob ? await blobToBase64(fileBlob) : undefined;

  return {
    ...file,
    fileBlob,
    fileBase64,
  };
}

async function getFiles(searchStr: string = "") {
  const files = await clientA.value.request(
    readFiles({
      limit: FILES_PER_PAGE,
      page: currentPage.value,
      search: searchStr,
      fields: [
        "*",
        "id",
        "title",
        "uploaded_on",
        "modified_on",
        { modified_by: ["id", "email", "first_name", "last_name", "avatar"] },
        { uploaded_by: ["id", "email", "first_name", "last_name", "avatar"] },
      ],
    })
  );
  const loadedAssets = await Promise.all(files.map((file) => loadFile(file)));

  return loadedAssets;
}

const init = async () => {
  const [client1, client2] = await initDirectusClients();
  clientA.value = client1;
  clientB.value = client2;
  requestInitData();
};
async function requestInitData() {
  filesCount.value = (
    await clientA.value.request(
      readFiles({
        //@ts-ignore
        aggregate: { countDistinct: "id" },
      })
    )
  )[0].countDistinct.id;
  files.value = await getFiles();
  loading.value = false;
}
onMounted(() => {
  init();
});

async function getAsset(id: string) {
  const url = getPublicURL() + `assets/${id}?download=true`;

  const params: Record<string, unknown> = {
    access_token: (
      api.defaults.headers.common["Authorization"] as string
    ).substring(7),
  };

  const exportUrl = api.getUri({
    url,
    params,
  });

  return fetch(exportUrl)
    .then(async (data) => {
      if (data.status !== 200) {
        const response = await data.json();
        throw new Error(response?.errors?.[0].message);
      }
      return data.blob();
    })
    .catch((e) => console.log("Failed to load asset: ", e));
}

async function handlePaginationChange() {
  loading.value = true;
  files.value = await getFiles();
  loading.value = false;
}

const handleSearchChange = debounce(async () => {
  loading.value = true;
  files.value = await getFiles(search.value || "");
  loading.value = false;
}, 300);

async function handleTransferFile() {
  for (let item of selected.value) {
    const file = new File([item.fileBlob], item.filename_download, {
      type: item.fileBlob.type,
    });

    const formData = new FormData();
    // in case to save initial id we need to add fields to form
    for (let [attr, value] of Object.entries(item)) {
      if (
        attr === "fileBlob" ||
        attr === "fileBase64" ||
        attr === "metadata" ||
        attr === "modified_by" ||
        attr === "uploaded_by" ||
        attr === "filesize"
      )
        continue;
      formData.append(attr, value);
    }
    formData.append("file", file);
    for (const item of formData.entries()) {
      console.log(item);
    }

    try {
      await clientB.value.request(updateFile(item.id, formData));
      notificationsStore.add({
        type: "success",
        title: "Item successfully transferred",
        dialog: true,
      });
    } catch (e) {
      notificationsStore.add({
        type: "error",
        title: "Error duiring apply",
        text: e?.errors?.[0]?.message,
        dialog: true,
      });
    }
  }
}
</script>

<template>
  <private-view title="Files">
    <template v-slot:navigation>
      <Nav :activeItem="nav['file-transfer'].id" />
    </template>
    <div class="wrapper">
      <div class="mb32 controls">
        <v-input
          v-model="search"
          @update:modelValue="handleSearchChange"
          class="searchInput"
          type="search"
          :placeholder="'Search files'"
          :full-width="false"
        >
          <template #prepend>
            <v-icon name="search" outline />
          </template>
          <template #append>
            <v-icon
              v-if="search"
              clickable
              class="clear"
              name="close"
              @click.stop="search = null"
            />
          </template>
        </v-input>

        <v-button
          @click="handleTransferFile"
          :loading="loading"
          :disabled="!selected.length"
        >
          Transfer files
        </v-button>
      </div>
      <VTable
        class="mb32"
        :showSelect="'multiple'"
        :headers="TABLE_HEADER"
        :items="Object.values(files)"
        :itemKey="'id'"
        v-model="selected"
        :loading="loading"
      >
        <template #[`item.img`]="{ item }">
          <img
            class="impPreview"
            v-if="item.fileBase64"
            :src="item.fileBase64"
            width="300"
            height="200"
          />
        </template>
        <template #[`item.modified_on`]="{ item }">
          {{
            format(item?.modified_on ?? item.uploaded_on, "dd.MM.yyyy HH:mm:ss")
          }}
        </template>
        <template #[`item.modified_by`]="{ item }">
          <a
            v-if="item?.modified_by?.id"
            class="link"
            target="_blank"
            :href="`users/${item?.modified_by?.id}`"
          >
            {{ `${item.modified_by.first_name} ${item.modified_by.last_name}` }}
          </a>
          <a
            v-if="item?.uploaded_by?.id"
            class="link"
            target="_blank"
            :href="`users/${item.uploaded_by.id}`"
          >
            {{ `${item.uploaded_by.first_name} ${item.uploaded_by.last_name}` }}
          </a>
        </template>
      </VTable>
      <v-pagination
        v-model="currentPage"
        v-bind="paginationState"
        onchange="handlePaginationChange"
        @update:modelValue="handlePaginationChange"
      />
    </div>
  </private-view>
</template>

<style lang="scss" scoped>
.loaderWrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
.wrapper {
  margin: 24px 32px;
}

.mb32 {
  margin-bottom: 32px;
}

.controls {
  display: flex;
  gap: 32px;
}

.searchInput {
  width: 100%;
}

.impPreview {
  object-fit: contain;
}
</style>

<style lang="scss">
.table-row {
  height: 200px !important;
}
</style>
