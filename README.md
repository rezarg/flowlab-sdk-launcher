# Flowlab SDK Launcher
The Flowlab SDK Launcher is a **third party program** that launches Flowlab games with additional features for Steam and Discord, such as **Steam Achievements**, **DLC support**, **Workshop support**, and **Discord Rich Presence**.

Flowlab SDK Launcher is brought to you by yours truly, ***rezarg***.

## Installation
Head on over to [releases](https://github.com/rezarg/flowlab-sdk-launcher/releases) and select the latest release. There, you'll find some important assets: `bundles.zip` and `FlowlabSDKLauncherSetup.exe`.

These files are:
1. `SDK Bundles.zip`: This includes the Behavior Import code for the various Flowlab Bundles, used to interact with the Launcher and the SteamSDK / DiscordSDK.
4. `FlowlabSDKLauncherSetup.exe`: This executable is an installer program that will help you setup the Flowlab SDK Launcher for your Flowlab Game by requesting necessary information.

After you've completed the Flowlab SDK Launcher setup, your game's file structure should look like so:
```txt
bin/
├── assets/
├── manifest/
├── workshop/ -- This will appear if you enabled Steam Workshop support.
│   └── preview.png
├── icon.ico
├── Launcher.exe -- You'll want to run this instead of YourGameName.exe when you want to play your game with SteamSDK and DiscordSDK support.
├── lime.ndll
└── YourGameName.exe
```

## Workshop Customization
You may have noticed the `workshop/` folder if you chose to include Steam Workshop support. If you open it up, you'll find `preview.png`. This is the default image if workshop assets. (A workshop item's image can be changed after uploading, this is just the default!)
