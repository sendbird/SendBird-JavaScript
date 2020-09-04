# SendBird JavaScript Web Basic Sample with SyncManager
This is full screen chat sample like Slack using [Sendbird SDK](https://github.com/sendbird/SendBird-SDK-JavaScript) for desktop browsers. SyncManager is included and applied.

- [Sendbird JavaScript Web Basic Sample with SyncManager](#sendbird-javascript-web-basic-sample-with-syncmanager)
  - [SyncManager](#syncmanager)
  - [Demo](#demo)
  - [Run the sample](#run-the-sample)
  - [Customizing the sample](#customizing-the-sample)

SyncManager for Javascript is a Chat SDK add-on that optimizes the user caching experience by interlinking the synchronization of the local data storage with the chat data in Sendbird server through an event-driven structure. Provided here is a SyncManager sample for Javascript to experience first-hand the benefits of Sendbird’s SyncManager.

### Benefits

Sendbird SyncManager provides the local caching system and data synchronization with the Sendbird server, which are run on an event-driven structure. According to the real-time events of the messages and channels, SyncManager takes care of the background tasks for the cache updates from the Sendbird server to the local device. By leveraging this systemized structure with connection-based synchronization, SyncManager allows you to easily integrate the Chat SDK to utilize all of its features, while also reducing data usage and offering a reliable and effortless storage mechanism. 

### Sendbird SyncManager for JavaScript doc

Find out more about Sendbird SyncManager for JavaScript at [SyncManager for JavaScript doc](https://docs.sendbird.com/javascript/sync_manager_getting_started).

<br />

## Before getting started
This section provides the prerequisites for testing Sendbird Desk for Javascript sample app.

### Requirements
The minimum requirements for SyncManager for Javascript are:
- Node. js v10+
- NPM v6+
- [Chat SDK for JavaScript](https://github.com/sendbird/SendBird-SDK-JavaScript) v3.0 115+

### Try the sample app applied with your data 

If you would like to try the sample app specifically fit to your usage, you can do so by replacing the default sample app ID with yours, which you can obtain by [creating your Sendbird application from the dashboard](https://docs.sendbird.com/javascript/quick_start#3_install_and_configure_the_chat_sdk_4_step_1_create_a_sendbird_application_from_your_dashboard). Furthermore, you could also add data of your choice on the dashboard to test. This will allow you to experience the sample app with data from your Sendbird application. 

### Try the SyncManager on our demo website 

By using this [link](https://sample.sendbird.com/basic/sync-manager), you can test the SyncManager through our demo website. 

<br />

## Getting started

You can install and run SyncManager for JavaScript sample app on your system using `npm`.

### Install packages

`Node` v8.x+ should be installed on your system.

```bash
npm install
```

### Run the sample

```bash
npm start
```

<br />

## Customizing the sample

To implement customization to the sample, you can use `webpack` for buiding it. 

### Install packages

`Node` v8.x+ should be installed on your system.

```bash
npm install
``` 

### Modify files

If you want to change `APP_ID`, change `APP_ID` in `const.js` to the other `APP_ID` you want.  You can test the sample with local server by running the following command.  

```bash
npm run start:dev
``` 

### Build the sample

When the modification is complete, you'll need to bundle the file using `webpack`. The bundled files are created in the **dist** folder. Please check `webpack.config.js` for settings.    

```bash
npm run build
```
