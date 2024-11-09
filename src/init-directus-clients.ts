import {
  createDirectus,
  rest,
  authentication,
} from "@directus/sdk";
import { useStores, useItems } from "@directus/extensions-sdk";
import { ref } from "vue";

const dirOrder = ['stage', 'prod'] as const;

export const initDirectusClients = async () => {
  const {
    useNotificationsStore,
  } = useStores();

  const envResult = useItems(ref("export_tools"), {
    limit: ref(-1),
    fields: ref(["*"]),
    filter: ref(null),
  });
  await envResult.getItems();

  const envConfig = envResult.items.value.reduce((acc, val) => {
    acc[val.type] = {
      ...val,
    }

    return acc;
  }, {});

  const notificationsStore = useNotificationsStore();

  let clientA;
  let clientB;

  try {
    clientA = createDirectus(envConfig[dirOrder[0]].url)
      .with(authentication())
      .with(rest());
    await clientA.login(
      envConfig[dirOrder[0]].login,
      envConfig[dirOrder[0]].password
    );

    clientB = createDirectus(envConfig[dirOrder[1]].url)
      .with(authentication())
      .with(rest());
    await clientB.login(
      envConfig[dirOrder[1]].login,
      envConfig[dirOrder[1]].password
    );
  } catch (e: any) {
    console.error(e);
    notificationsStore.add({
      type: "error",
      title: 'Login Error',
      text: e?.errors?.[0]?.message,
      dialog: true,
    });
  }

  return [clientA, clientB];
};
