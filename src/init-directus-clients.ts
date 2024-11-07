import {
  createDirectus,
  rest,
  authentication,
} from "@directus/sdk";
import { useStores } from "@directus/extensions-sdk";

// TODO: change to DB request
const envConfig = {
  stageDirectus: {
    name: "Stage Directus 1",
    url: "http://0.0.0.0:8055",
    login: "admin@example.com",
    password: "testTest",
  },
  prodDirectus: {
    name: "Prod Directus 2",
    url: "http://0.0.0.0:8056",
    login: "admin@example.com",
    password: "testTest",
  },
};

export const initDirectusClients = async () => {
  const {
    useNotificationsStore,
  } = useStores();
  const notificationsStore = useNotificationsStore();

  let clientA;
  let clientB;

  try {
    clientA = createDirectus(envConfig.stageDirectus.url)
      .with(authentication())
      .with(rest());
    await clientA.login(
      envConfig.stageDirectus.login,
      envConfig.stageDirectus.password
    );

    clientB = createDirectus(envConfig.prodDirectus.url)
      .with(authentication())
      .with(rest());
    await clientB.login(
      envConfig.prodDirectus.login,
      envConfig.prodDirectus.password
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
