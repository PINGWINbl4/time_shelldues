const mqtt = require("mqtt");
//const cron = require('node-cron');

const mqttUrl = "mqtt://hs.k-telecom.org:8883";
const mqttOptions = {
  // Clean session
  clean: true,
  connectTimeout: 1000,
  // Authentication
  clientId: "serv1234567890",
  username: "MQTTUser",
  password: "MQTTpassword1!",
};

var cron = require('node-cron');
const mqttClient = mqtt.connect(mqttUrl, mqttOptions);

mqttClient.on("connect", function () {
    if (mqttClient.connected) {
      console.log("conected");
      //mqttClient.subscribe("#");  // Подпись на все топики
      let used = process.memoryUsage().heapUsed / 1024 / 1024;
  
      console.log(used)
        cron.schedule('* * * * *', () => {
            console.log('running a task every minute');
        });
        console.log(process.memoryUsage().heapUsed / 1024 / 1024)
        
        cron.schedule('* * * * *', () => {
            console.log('running a task every minute');
        });
        console.log(process.memoryUsage().heapUsed / 1024 / 1024)

    } else {
      console.log("disconeted");
    }
  });

