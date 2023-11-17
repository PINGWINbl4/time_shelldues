const { PrismaClient } = require('@prisma/client');
const { postEmailMessage,
        postPushMessage } = require('./notification')
const db = new PrismaClient();
const http = require('http')
var cron = require('node-cron');
cron.schedule('* * * * *',async () => {
    try{
        findAllTimeShelldue()
        findOutdatedShelldues()
    }
    catch(err){
        console.log(err)
    }
});

cron.schedule('* * * * *',async () => {
    try {
        const date = new Date()
        cities = await db.city.findMany({
            skip: date.getMinutes()*60,
            take: 60
        })
        console.log(cities)
        cities.forEach(async city => {
            const lat = city.lat
            const lon = city.lon
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.WEATHER_KEY_1}`
            if(lat & lon){
                let weatherReq = await fetch(url).then().catch((err)=>console.log(err))
                const weatherData = await weatherReq.json()
                await db.weather.create({
                    data:{
                        cityId:city.id,
                        weatherData:{
                            temp: weatherData.main.temp,
                            pressure: weatherData.main.pressure,
                            humidity: weatherData.main.humidity,
                            clouds: weatherData.clouds.all
                        }
                    }
                })
            }
        });
    } catch (error) {
        
    }
});

async function getCurrentTime(){
    const currentTime = new Date()
    currentTime.setSeconds(0)
    currentTime.setMilliseconds(0)
    currentTime.setFullYear(1970)
    currentTime.setMonth(0)
    currentTime.setDate(1)
    currentTime.setHours(currentTime.getHours()+5)
    currentTime.setMinutes(currentTime.getMinutes()+1)
    return currentTime
}


async function findAllTimeShelldue(){
    const currentTime = await getCurrentTime()
    const allTimeShelldues = await db.Shelldue.findMany({
        where:{
            shelldueType:"time",
            runtimeStart:{
                lte: currentTime
            },
            runtimeEnd:{
                gt: currentTime
            },
            executing: false,
            active: true
            //runtime: currentTime
        }
    })
    for (let i = 0; i < allTimeShelldues.length; i++) {
        postSets(allTimeShelldues[i])
    }
}

async function findOutdatedShelldues(){
    const currentTime = await getCurrentTime()
    const pastShelldue = await db.Shelldue.findMany({
        where:{
            shelldueType:"time",
            runtimeEnd:{
                lte: currentTime
            },
            executing: true
            //runtime: currentTime
        }
    })
    for (let i = 0; i < pastShelldue.length; i++) {
        try{
            postSets(pastShelldue[i])
            postNotification()
        }
        catch(err){
            console.log(err)
        }
    }
}

async function postSets(shelldue){
    try {  
        for (let i = 0; i < shelldue.shelldueScript.actions.set.length; i++) {
            const set = shelldue.shelldueScript.actions.set[i];
                const sensor = await db.sensor.findFirst({
                    where:{
                      elementId: set.elementId
                    },
                    include:{
                        SensorSettings:true
                    }
                  })
                  const station = await db.station.findFirst({
                    where:{
                      id: sensor.stationId
                    }
                  })
                  const topic = `${shelldue.userId}/${station.gatewayId}/${sensor.elementId}/set`
                  const postData = {
                    method: "POST",
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      topic: topic,
                      shelldueScript: set
                    })
                  } 
                  //console.log(postData)
                  if(set.executing != shelldue.executing){
                    console.log(postData.body)
                    fetch(`http://${process.env.SHELLDUE_HOST}:${process.env.SHELLDUE_PORT}/`, postData)
                    .then(async (res) => {
                        console.log(await res.json())
                    })
                    .catch(err => {throw new Error(err)})
                    const toLog = {
                        userId: shelldue.userId,
                        sensorId: sensor.id,
                        stationId: station.id,
                        shelldueId: shelldue.id,
                        sensorName: sensor.SensorSettings.name,
                        shelldueName: shelldue.name
                    }
                    console.log(toLog)
                    set.executing? writeToLog(toLog, 1):writeToLog(toLog, 3)
                  }     
        }
        await db.Shelldue.update({
            where:{
                id: shelldue.id
            },
            data:{
                executing: !shelldue.executing
            }
        })
    } catch (error) {
        console.log(error)
    }
}

async function postNotification(){
    if(Object.keys(action).includes("notification")){
        for (let i = 0; i < action.notification.length; i++) {
            const body = action.notification[i].notificationMessage
            console.log(stationsShelldue)
            if(action.notification[i].executing == stationsShelldue.executing){
                switch (action.notification[i].messageType){
                    case "push":
                        const title = stationsShelldue.name
                        postPushMessage(user, title, body)
                        break;
                    case "email":
                        postEmailMessage(user, body)
                        break
                    default:
                        throw new Error(`Invalid notification action. Expected push or email. Geted ${action.notification.messageType}`);
                }
            }
        }
    }
}

async function writeToLog(data, code){
    try{
      const url = `http://${process.env.LOGGER_HOST || "localhost"}:${process.env.LOGGER_PORT || "5282"}/${code}` 
      const postData = {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: data
        })
      }
      await fetch(url, postData)
      .then(console.log(`${data.shelldueName} change status. Log req sended.\n User with id:${data.userId} can see it soon`))
      .catch(err => {throw new Error(err)})
    }
    catch(err){
      console.log(err)
    }
}