const { PrismaClient } = require('@prisma/client');
const { timeLog } = require('console');

const db = new PrismaClient();
const http = require('http')
var cron = require('node-cron');
cron.schedule('* * * * *',async () => {
    findAllTimeShelldue()
    findOutdatedShelldues()
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
            executing: false
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
        postSets(pastShelldue[i])
    }
}

async function postSets(shelldue){
    for (let i = 0; i < shelldue.shelldueScript.actions.set.length; i++) {
        const set = shelldue.shelldueScript.actions.set[i];
            const sensor = await db.sensor.findFirst({
                where:{
                  elementId: set.elementId
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
                const toLog = {
                    userId: shelldue.userId,
                    sensorId: sensor.id,
                    stationId: station.id,
                    shelldueId: shelldue.id
                }
                writeToLog(toLog, 1)
                .then(async (res) => {
                  console.log(await res.json())
                })
                .catch(err => {throw new Error(err)})
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
}


async function writeToLog(data, code){

    const logCode = await db.EventCode.findUnique({
        where:{
            code: code
        }
    })

    data.codeId = logCode.id
    const eLog = await db.EventLog.create({
        data:data
    })
    return eLog
}