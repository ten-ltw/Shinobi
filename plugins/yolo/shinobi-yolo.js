//
// Shinobi - Yolo Plugin
// Copyright (C) 2016-2025 Moe Alam, moeiscool
//
// # Donate
//
// If you like what I am doing here and want me to continue please consider donating :)
// PayPal : paypal@m03.ca
//
process.on('uncaughtException', function (err) {
    console.error('uncaughtException',err);
});
var fs=require('fs');
var yolo = require('@vapi/node-yolo');
var exec = require('child_process').exec;
var moment = require('moment');
var express = require('express');
var http = require('http'),
    app = express(),
    server = http.createServer(app);
var config=require('./conf.json');
if(!config.port){config.port=8080}
if(!config.hostPort){config.hostPort=8082}
if(config.systemLog===undefined){config.systemLog=true}
if(config.cascadesDir===undefined){config.cascadesDir=__dirname+'/cascades/'}
var detector = new yolo(__dirname + "/models", "cfg/coco.data", "cfg/yolov3.cfg", "yolov3.weights");
s={
    group:{},
    dir:{
        cascades : config.cascadesDir
    },
    isWin:(process.platform==='win32'),
    foundCascades : {

    }
}
//default stream folder check
if(!config.streamDir){
    if(s.isWin===false){
        config.streamDir='/dev/shm'
    }else{
        config.streamDir=config.windowsTempDir
    }
    if(!fs.existsSync(config.streamDir)){
        config.streamDir=__dirname+'/streams/'
    }else{
        config.streamDir+='/streams/'
    }
}
s.dir.streams=config.streamDir;
//streams dir
if(!fs.existsSync(s.dir.streams)){
    fs.mkdirSync(s.dir.streams);
}
//streams dir
if(!fs.existsSync(s.dir.cascades)){
    fs.mkdirSync(s.dir.cascades);
}
s.gid=function(x){
    if(!x){x=10};var t = "";var p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < x; i++ )
        t += p.charAt(Math.floor(Math.random() * p.length));
    return t;
};
s.detectObject=function(buffer,d,tx){
  d.tmpFile=s.gid(5)+'.jpg'
  d.tmpFile2=s.gid(5)+'.jpg'
  if(!fs.existsSync(s.dir.streams)){
      fs.mkdirSync(s.dir.streams);
  }
  d.dir=s.dir.streams+d.ke+'/'
  if(!fs.existsSync(d.dir)){
      fs.mkdirSync(d.dir);
  }
  d.dir=s.dir.streams+d.ke+'/'+d.id+'/'
  if(!fs.existsSync(d.dir)){
      fs.mkdirSync(d.dir);
  }
  fs.writeFile(d.dir+d.tmpFile,buffer,function(err){
      if(err) return s.systemLog(err);
      try{
          detector.detect(d.dir+d.tmpFile)
               .then(detections => {
                   matrices = []
                   detections.forEach(function(v){
                       matrices.push({
                         x:v.box.x,
                         y:v.box.y,
                         width:v.box.w,
                         height:v.box.h,
                         tag:v.className,
                         confidence:v.probability,
                       })
                   })
                   if(matrices.length > 0){
                       tx({
                           f:'trigger',
                           id:d.id,
                           ke:d.ke,
                           details:{
                               plug:config.plug,
                               name:'yolo',
                               reason:'object',
                               matrices:matrices,
                               imgHeight:parseFloat(d.mon.detector_scale_y),
                               imgWidth:parseFloat(d.mon.detector_scale_x)
                           }
                       })
                   }
                   fs.unlink(d.dir+d.tmpFile,function(){

                   })
               })
               .catch(error => {
                   console.log(error)

                 // here you can handle the errors. Ex: Out of memory
             })
      }catch(error){
          console.error('Catch: ' + error);
      }
  })
}
s.systemLog=function(q,w,e){
    if(!w){w=''}
    if(!e){e=''}
    if(config.systemLog===true){
       return console.log(moment().format(),q,w,e)
    }
}

s.MainEventController=function(d,cn,tx){
    switch(d.f){
        case'refreshPlugins':
            s.findCascades(function(cascades){
                s.cx({f:'s.tx',data:{f:'detector_cascade_list',cascades:cascades},to:'GRP_'+d.ke})
            })
        break;
        case'readPlugins':
            s.cx({f:'s.tx',data:{f:'detector_cascade_list',cascades:s.cascadesInDir},to:'GRP_'+d.ke})
        break;
        case'init_plugin_as_host':
            if(!cn){
                console.log('No CN',d)
                return
            }
            if(d.key!==config.key){
                console.log(new Date(),'Plugin Key Mismatch',cn.request.connection.remoteAddress,d)
                cn.emit('init',{ok:false})
                cn.disconnect()
            }else{
                console.log(new Date(),'Plugin Connected to Client',cn.request.connection.remoteAddress)
                cn.emit('init',{ok:true,plug:config.plug,notice:config.notice,type:config.type})
            }
        break;
        case'init_monitor':
            if(s.group[d.ke]&&s.group[d.ke][d.id]){
                s.group[d.ke][d.id].canvas={}
                s.group[d.ke][d.id].canvasContext={}
                s.group[d.ke][d.id].blendRegion={}
                s.group[d.ke][d.id].blendRegionContext={}
                s.group[d.ke][d.id].lastRegionImageData={}
                s.group[d.ke][d.id].numberOfTriggers=0
                delete(s.group[d.ke][d.id].cords)
                delete(s.group[d.ke][d.id].buffer)
            }
        break;
        case'init_aws_push':
//            console.log('init_aws')
            s.group[d.ke][d.id].aws={links:[],complete:0,total:d.total,videos:[],tx:tx}
        break;
        case'frame':
            try{
                if(!s.group[d.ke]){
                    s.group[d.ke]={}
                }
                if(!s.group[d.ke][d.id]){
                    s.group[d.ke][d.id]={
                        canvas:{},
                        canvasContext:{},
                        lastRegionImageData:{},
                        blendRegion:{},
                        blendRegionContext:{},
                    }
                }
                if(!s.group[d.ke][d.id].buffer){
                  s.group[d.ke][d.id].buffer=[d.frame];
                }else{
                  s.group[d.ke][d.id].buffer.push(d.frame)
                }
                if(d.frame[d.frame.length-2] === 0xFF && d.frame[d.frame.length-1] === 0xD9){
                    var buffer = Buffer.concat(s.group[d.ke][d.id].buffer);
                    s.detectObject(buffer,d,tx)
                    s.group[d.ke][d.id].buffer=null;
                }
            }catch(err){
                if(err){
                    s.systemLog(err)
                    delete(s.group[d.ke][d.id].buffer)
                }
            }
        break;
    }
}
server.listen(config.hostPort);
//web pages and plugin api
app.get('/', function (req, res) {
  res.end('<b>'+config.plug+'</b> for Shinobi is running')
});
//Conector to Shinobi
if(config.mode==='host'){
    //start plugin as host
    var io = require('socket.io')(server);
    io.attach(server);
    s.connectedClients={};
    io.on('connection', function (cn) {
        s.connectedClients[cn.id]={id:cn.id}
        s.connectedClients[cn.id].tx = function(data){
            data.pluginKey=config.key;data.plug=config.plug;
            return io.to(cn.id).emit('ocv',data);
        }
        cn.on('f',function(d){
            s.MainEventController(d,cn,s.connectedClients[cn.id].tx)
        });
        cn.on('disconnect',function(d){
            delete(s.connectedClients[cn.id])
        })
    });
}else{
    //start plugin as client
    if(!config.host){config.host='localhost'}
    var io = require('socket.io-client')('ws://'+config.host+':'+config.port);//connect to master
    s.cx=function(x){x.pluginKey=config.key;x.plug=config.plug;return io.emit('ocv',x)}
    io.on('connect',function(d){
        s.cx({f:'init',plug:config.plug,notice:config.notice,type:config.type});
    })
    io.on('disconnect',function(d){
        io.connect();
    })
    io.on('f',function(d){
        s.MainEventController(d,null,s.cx)
    })
}
