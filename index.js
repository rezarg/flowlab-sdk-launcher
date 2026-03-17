const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const steamworks = require("steamworks.js");
const discordRPC = require("discord-rpc");
const express = require("express");
const cors = require("cors");

require("dotenv").config();

const launcherConfig = {
  application: "",
  app_id: 480,
  discord_app_id: ""
}

const exeData = fs.readFileSync(process.execPath).toString();
const lines = exeData.split("\n");
const lastLine = lines[lines.length - 1];
const match = lastLine.match(/exe-(.*?)-sai-(.*?)-dai-(.*)/);

if (match) {
  launcherConfig.application = match[1].trim();
  launcherConfig.app_id = parseInt(match[2].trim());
  launcherConfig.discord_app_id = match[3].trim();
}

if (launcherConfig.application.endsWith(".exe.app")) {
  launcherConfig.application.slice(0, -4)
}

console.log("LauncherConfig loaded:", launcherConfig);

/* UTIL FUNCTIONS */

function generateUUID() {
  return '4xxxyxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/* GAME PROCESS */

if (launcherConfig.application && launcherConfig.application.length > 0) {
  const realDir = path.dirname(process.execPath);

  let gameProcess;
  if (process.platform == "win32") {
    const gamePath = launcherConfig.application;
    console.log("Platform: win32 :: application path: ", gamePath);
    gameProcess = spawn(`${realDir}\\${launcherConfig.application}`, [], { detached: true, stdio: "ignore" });
  } else if (process.platform == "darwin") {
    if (launcherConfig.application.endsWith(".exe")) {
      launcherConfig.application = launcherConfig.application.slice(0, -4);
    }
    const gamePath = `${launcherConfig.application}.app`;
    console.log("Platform: darwin :: application path: ", gamePath);
    gameProcess = spawn(`open`, ["-W", `${realDir}/${gamePath}`], { detached: true, stdio: "ignore" });
  }

  gameProcess.unref();

  gameProcess.on("close", (code) => {
    console.log("The game closed! Closing the process too...");
    process.exit(code);
  });

  process.on("exit", () => {
    if (gameProcess) {
      gameProcess.kill("SIGINT");
    }
  });

  process.on("SIGINT", () => {
    if (gameProcess) {
      gameProcess.kill("SIGINT");
    }
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    if (gameProcess) {
      gameProcess.kill("SIGINT");
    }
  });
}

/* STEAMWORKS INIT */

var client;
if (!isNaN(launcherConfig.app_id)) {
  console.log("Initializing Steamworks SDK...");
  // steamworks.restartAppIfNecessary(launcherConfig.app_id);
  client = steamworks.init(launcherConfig.app_id);
  console.log("Steamworks initialized.");
}

/* DISCORD INIT */

var rpc;
var startTimestamp = new Date();
var activity = {};
if (launcherConfig.discord_app_id.length > 1) {
  console.log("Initializing Discord SDK...");
  rpc = new discordRPC.Client({ transport: "ipc" });
}

/* SERVER */

const app = express();
app.use(cors());
app.use((req, _, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const port = 3000;

app.get("/", (_, res) => {
  res.status(200).send(`
    <style>
      li a {
        border: 1px solid #ccc;
        border-radius: 5px;
        padding: 2px 5px;
      }
      li {
        list-style-type: none;
        margin-bottom: 10px;
      }
      .deprecated {
        color: #EEE;
        background-color: #999;
        padding: 2px 15px;
        margin-top: 5px;
        margin-bottom: 5px;
        margin-right: 10px;
        border-radius: 50px;
      }
    </style>
    <h1 align="center">Flowlab Interactions API</h1>
    <hr>
    <h2 align="center">Steam SDK</h2>
    <p>Achievements</p>
    <ul>
      <li><a href="./achievement/unlock/:id">/achievement/unlock/:id</a> - Active the specified ACH_ID.</li>
      <li><span class="deprecated">DEPRECATED</span><a href="./achievement/isUnlocked/:id">/achievement/isUnlocked/:id</a> - Check if the specified ACH_ID is activated. Returns 0 or 1.</li>
      <li><a href="./achievement/reset/:id">/achievement/reset/:id</a> - Clear the specified ACH_ID.</li>
    </ul>
    <p>DLC</p>
    <ul>
      <li><a href="./dlc/isInstalled/:id">/dlc/isInstalled/:id</a> - Check if the specified DLC's appId is installed. Returns 0 or 1.</li>
    </ul>
    <p>Workshop</p>
    <ul>
      <li><a href="./workshop/createItem/:title/:description/:tags/:content">/workshop/createItem/:title/:description/:tags/:content</a> - Create a workshop item with the specified parameters. Returns the itemId.</li>
      <li><a href="./workshop/updateItem/:itemId/:title/:description/:tags/:content">/workshop/updateItem/:itemId/:title/:description/:tags/:content</a> - Update the specified workshop itemId with the specified parameters. Returns the itemId.</li>
      <li><a href="./workshop/subscribe/:itemId">/workshop/subscribe/:itemId</a> - Subscribe to the specified workshop itemId. Returns the itemId.</li>
      <li><a href="./workshop/unsubscribe/:itemid">/workshop/unsubscribe/:itemId</a> - Unsubscribe from the specified workshop itemId. Returns the itemId.</li>
      <li><a href="./workshop/getSubscriptions">/workshop/getSubscriptions</a> - Get all subscribed items. Returns a comma-separated list of itemIds. (i.e. "5938185,5938133,5895805,...")</li>
      <li><a href="./workshop/getItemPage/:itemId">/workshop/getItemPage/:itemId</a> - Get the specified workshop itemId page. Returns a string with the format of X:AXBXC where X is a unique separator, A is the title, B is the description, and C is the creator's username.</li>
      <li><a href="./workshop/getItemContent/:itemId">/workshop/getItemContent/:itemId</a> - Get the specified workshop itemId content. Returns a string.</li>
    </ul>
    <hr>
    <h2 align="center">Discord SDK</h2>
    <p>Discord RPC</p>
    <ul>
      <li><a href="./discord-rpc/update/:newActivity">/discord-rpc/update/:newActivity</a> - Update the Discord RPC activity.</li>
    </ul>
  `);
});

/* STEAM ACHIEVEMENTS */

app.get("/achievement/unlock/:id", (req, res) => {
  const { id } = req.params;

  if (!client) {
    res.status(200).send(`achievement/set ${id} 0`);
    return;
  }

  if (client.achievement.isActivated(id)) {
    res.status(200).send(`achievement/set ${id} 1`);
    console.log(`/achievement/unlock/ - Achievement ${id} is already unlocked.`);
  } else {
    if (client.achievement.activate(id)) {
      res.status(200).send(`achievement/set ${id} 1`);
      console.log(`/achievement/unlock/ - Achievement ${id} unlocked.`);
    } else {
      res.status(200).send(`achievement/set ${id} 0`);
      console.error(`/achievement/unlock/ - Failed to unlock achievement ${id}.`);
    }
  }
});

// app.get("/achievement/isUnlocked/:id", (req, res) => {
//   if (!client) {
//     res.status(500).send("0");
//     return;
//   }

//   const { id } = req.params;
//   if (client.achievement.isActivated(id)) {
//     res.status(200).send("1");
//     console.log(`/achievement/isUnlocked/ - Achievement ${id} is unlocked.`);
//   } else {
//     res.status(200).send("0");
//     console.log(`/achievement/isUnlocked/ - Achievement ${id} is not unlocked.`);
//   }
// });

app.get("/achievement/reset/:id", (req, res) => {
  const { id } = req.params;

  if (!client) {
    res.status(200).send(`achievement/clear ${id} 0`);
    return;
  }

  if (client.achievement.isActivated(id)) {
    if (client.achievement.clear(id)) {
      res.status(200).send(`achievement/clear ${id} 1`);
      console.log(`/achievement/reset/ - Achievement ${id} cleared.`);
    } else {
      res.status(200).send(`achievement/clear ${id} 0`);
      console.error(`/achievement/reset/ - Failed to clear achievement ${id}.`);
    }
  } else {
    res.status(200).send(`achievement/clear ${id} 0`);
    console.log(`/achievement/reset/ - Achievement ${id} is not unlocked.`);
  }
});

/* STEAM DLC */

app.get("/dlc/isInstalled/:id", (req, res) => {
  const { id } = req.params;

  if (!client) {
    res.status(200).send(`dlc/get ${id} 0`);
    return;
  }

  if (client.apps.isDlcInstalled(parseInt(id))) {
    res.status(200).send(`dlc/get ${id} 1`);
    console.log(`/dlc/isInstalled/ - DLC ${id} is installed.`);
  } else {
    res.status(200).send(`dlc/get ${id} 0`);
    console.log(`/dlc/isInstalled/ - DLC ${id} is not installed.`);
  }
});

/* STEAM WORKSHOP */

app.get("/workshop/createItem/:title/:description/:tags/:content", (req, res) => {
  if (!client) {
    res.status(500).send("0");
    return;
  }

  const { title, description, tags, content } = req.params;
  client.workshop.createItem(launcherConfig.app_id).then((value) => {
    console.log(`/workshop/createItem/ - Item created: ${value.itemId}. Needs to accept agreement? ${value.needsToAcceptAgreement}`);

    if (!fs.existsSync("./workshop")) {
      fs.mkdirSync("./workshop", { recursive: true });
    }

    fs.writeFileSync("./workshop/content.txt", content, "utf-8");

    client.workshop.updateItem(value.itemId, {
      title: title,
      description: description,
      visibility: client.workshop.UgcItemVisibility.Public,
      tags: tags.split(","),
      contentPath: "./workshop/content.txt",
      previewPath: fs.existsSync("./workshop/preview.png") ? "./workshop/preview.png" : undefined,
    }).then((value) => {
      console.log(`/workshop/createItem/ - Item updated: ${value.itemId}`);
      client.workshop.subscribe(value.itemId).then(() => {
        console.log(`/workshop/createItem/ - Item subscribed: ${value.itemId}`);
        const checkInstallInterval = setInterval(() => {
          const installInfo = client.workshop.installInfo(value.itemId);
          if (installInfo) {
            clearInterval(checkInstallInterval);
            console.log("/workshop/createItem/ - Item installed:", installInfo);
          }
        }, 1000);
      });
    });

    res.status(200).send(`${value.itemId}`);
  });
});

app.get("/workshop/updateItem/:itemId/:title/:description/:tags/:content", (req, res) => {
  if (!client) {
    res.status(500).send("0");
    return;
  }

  const { itemId, title, description, tags, content } = req.params;

  console.log("/workshop/updateItem/ - Updating item:", parseInt(itemId), title, description, tags, content);

  if (!fs.existsSync("./workshop")) {
    fs.mkdirSync("./workshop", { recursive: true });
  }

  fs.writeFileSync("./workshop/content.txt", "content", "utf-8");

  client.workshop.updateItem(BigInt(itemId), {
    title: title,
    description: description,
    tags: tags.split(","),
    contentPath: "./workshop/content.txt",
    previewPath: fs.existsSync("./workshop/preview.png") ? "./workshop/preview.png" : undefined,
  }).then((_) => {
    res.status(200).send(`${itemId}`);
  });
});

app.get("/workshop/subscribe/:itemId", (req, res) => {
  if (!client) {
    res.status(500).send("0");
    return;
  }

  const { itemId } = req.params;
  client.workshop.subscribe(BigInt(itemId)).then(() => {
    console.log(`/workshop/subscribe/ - Item subscribed: ${itemId}`);
    res.status(200).send(`${itemId}`);
  });
});

app.get("/workshop/unsubscribe/:itemId", (req, res) => {
  if (!client) {
    res.status(500).send("0");
    return;
  }

  const { itemId } = req.params;
  client.workshop.unsubscribe(BigInt(itemId)).then(() => {
    console.log(`/workshop/unsubscribe/ - Item unsubscribed: ${itemId}`);
    res.status(200).send(`${itemId}`);
  });
});

app.get("/workshop/getSubscriptions", (_, res) => {
  if (!client) {
    res.status(500).send("0");
    return;
  }

  const installedItems = client.workshop.getSubscribedItems().join(",");
  console.log("/workshop/getSubscriptions/ - Subscribed items:", installedItems);
  res.status(200).send(installedItems);
});

// app.get("/workshop/getItemPage/:itemId", (req, res) => {
//   if (!client) {
//     res.status(500).send("0");
//     return;
//   }
// 
//   const { itemId } = req.params;
//   client.workshop.getItem(BigInt(itemId)).then(async (item) => {
//     console.log("/workshop/getItemPage/ - Item:", itemId, item);
//     if (!item) { throw "No Item"; }
//     if (!item.owner) { throw "No Owner"; }
//     let playerSummaries = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.API_KEY}&steamids=${item.owner.steamId64}`);
//     playerSummaries = await playerSummaries.json();
//     const ownerProfile = playerSummaries.response.players[0];
//     const result = {
//       title: item.title,
//       description: item.description,
//       owner: ownerProfile.personaname,
//     }
//     console.log("/workshop/getItemPage/ - Item page:", itemId, result);
//     const uuid = generateUUID();
//     res.status(200).send(`${uuid}:${Object.values(result).join(uuid)}`);
//   }).catch((err) => {
//     console.error("/workshop/getItemPage/ - Error:", err);
//     res.status(500).send(err);
//   });
// });

app.get("/workshop/getItemContent/:itemId", (req, res) => {
  if (!client) {
    res.status(500).send("0");
    return;
  }

  const { itemId } = req.params;
  const installInfo = client.workshop.installInfo(BigInt(itemId));
  console.log("/workshop/getItemContent/ - Install info:", installInfo);
  if (!installInfo) {
    console.error("/workshop/getItemContent/ - Item not installed:", itemId);
    res.status(500).send("0");
    return;
  }
  const contentPath = path.join(installInfo.folder, "content.txt");
  console.log("/workshop/getItemContent/ - Content path:", contentPath);
  if (!fs.existsSync(contentPath)) {
    console.error("/workshop/getItemContent/ - Content not found:", contentPath);
    res.status(500).send("0");
    return;
  }
  fs.readFile(contentPath, "utf-8", (err, data) => {
    if (err) {
      console.error("/workshop/getItemContent/ - Error reading content file:", err);
      res.status(500).send("0");
      return;
    }
    console.log("/workshop/getItemContent/ - Content read:", itemId, data);
    res.status(200).send(data);
  });
});

/* DISCORD RPC */

app.get("/discord-rpc/update/:data", (req, res) => {
  console.log("/discord-rpc/update/ - Update request received:", req.params.data);

  if (!rpc || !rpc.user) {
    console.log("/discord-rpc/update/ - Discord RPC failed because RPC or RPC User is null. RPC:", rpc);
    res.status(500).send("0");
    return;
  }

  const { data } = req.params;

  var hexTable = {
    "00": "A", "01": "B", "02": "C",
    "03": "D", "04": "E", "05": "F", "06": "G",
    "07": "H", "08": "I", "09": "J", "0A": "K",
    "0B": "L", "0C": "M", "0D": "N", "0E": "O",
    "0F": "P", "10": "Q", "11": "R", "12": "S",
    "13": "T", "14": "U", "15": "V", "16": "W",
    "17": "X", "18": "Y", "19": "Z", "1A": "a",
    "1B": "b", "1C": "c", "1D": "d", "1E": "e",
    "1F": "f", "20": "g", "21": "h", "22": "i",
    "23": "j", "24": "k", "25": "l", "26": "m",
    "27": "n", "28": "o", "29": "p", "2A": "q",
    "2B": "r", "2C": "s", "2D": "t", "2E": "u",
    "2F": "v", "30": "w", "31": "x", "32": "y",
    "33": "z", "34": "0", "35": "1", "36": "2",
    "37": "3", "38": "4", "39": "5", "3A": "6",
    "3B": "7", "3C": "8", "3D": "9", "3E": "!",
    "3F": "@", "40": "#", "41": "$", "42": "%",
    "43": "^", "44": "&", "45": "*", "46": "(",
    "47": ")", "48": "-", "49": "=", "4A": "_",
    "4B": "+", "4C": "`", "4D": "~", "4E": "[",
    "4F": "{", "50": "]", "51": "}", "52": ";",
    "53": ":", "54": "'", "55": "\"", "56": "\\",
    "57": "|", "58": ",", "59": "<", "5A": ".",
    "5B": ">", "5C": "/", "5D": "?", "5E": " ",
  };

  const newActivity = {};
  for (const [index, value] of data.split("-").entries()) {
    if (value && value.length > 0) {
      let newValue = "";
      for (let i = 0; i < value.length; i += 2) {
        const hex = value.substring(i, i + 2);
        newValue += hexTable[hex];
      }

      newActivity[index] = newValue;
    }
  }

  const keys = [
    "state",
    "details",
    "startTimestamp",
    "endTimestamp",
    "largeImageKey",
    "largeImageText",
    "smallImageKey",
    "smallImageText",
    "partySize",
    "partyMax"
  ]

  for (const [index, value] of Object.entries(newActivity)) {
    const key = keys[index];
    console.log(`/discord-rpc/update/ - Setting ${key} to ${value}`);
    if (key == "startTimestamp" || key == "endTimestamp" || key == "partySize" || key == "partyMax") {
      activity[key] = parseInt(value);
    } else {
      activity[key] = value;
    }
  }

  console.log(activity);
  rpc.setActivity(activity);
  res.status(200).send("1");
});

if (rpc) {
  rpc.on("ready", () => {
    console.log(`Discord RPC is logged in as ${rpc.user.username}`);
    activity.startTimestamp = startTimestamp;
  });

  rpc.login({ clientId: launcherConfig.discord_app_id }).catch(console.error);
}

process.on('SIGINT', function () {
  console.log("\nShutting down (Ctrl-C)");
  process.exit(0);
});

/* START */

app.listen(port, () => {
  console.log(`Flowlab SDK Server is running on http://localhost:${port}`);
});
