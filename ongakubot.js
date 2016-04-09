var Discord = require('discord.js');
var bot = new Discord.Client({ revive: true });

var fs = require('fs');
var ytdl = require('ytdl-core');
var request = require('request');
var urljs = require('url');

var config = require(__dirname + '/config.json');

bot.on('ready', () => {
  bot.setStatus('online', '', (error) => { if(error) console.log(error); });
  console.log('# ongaku is ready');
});

bot.on('error', (error) => {
  console.log(error);
});

bot.on("autoRevive", () => {
  console.log('# Revived');
});

bot.on('disconnected', () => {
  console.log('# Disconnected');
});

bot.login(config.login.email, config.login.password, (error, token) => {
  if(error){ console.log(error); return; }
  console.log('# Connecting ...');
});

var playlistqueue = [];
var playlisthistory = [];
var volume = 0.1;

function playNextSong() {
  if(playlistqueue.length === 0 || bot.voiceConnection === null) { //on playlist end or no voice connection -> write message and stop
    bot.setStatus('online', 'silence.', (error) => { if(error) console.log(error); });
    //bot.sendMessage(message.channel,':wind_chime: Playlist end reached.', { tts: false }, (error, msg) => { if(error) console.log(error); });
    return;
  }

  if(playlistqueue[0].type === 'youtube'){
    ytdl.getInfo(playlistqueue[0].url, { filter: function(format) { return format.container === 'mp4'; } }, (error, info) => {
      if (error || typeof info === 'undefined'){// on error skip the current song
        bot.sendMessage(playlistqueue[0].message.channel, 'Something went wrong :crying_cat_face: while trying to play **' + playlistqueue[0].title + '**.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        playlistqueue.splice(0, 1);
        playNextSong();
        return;
      }

      var bestformat = { audioBitrate: 0 };
      info.formats.forEach((format) => {
        if(format.encoding == null && format.audioEncoding != null && format.audioBitrate > 127 && bestformat.audioBitrate < format.audioBitrate) bestformat = format;
      });
      if(bestformat.audioBitrate !== 0){
        bot.voiceConnection.playFile(bestformat.url, {
          volume : volume
        }, function (error, playingIntent){
          if (error){// on error skip the current song
            bot.sendMessage(playlistqueue[0].message.channel, 'Something went wrong :rooster: while trying to play **' + playlistqueue[0].title + '**.', { tts: false }, (error, msg) => { if(error) console.log(error); });
            playlistqueue.splice(0, 1);
            playNextSong();
          }else{
            playlisthistory.push(playlistqueue[0]);
            playlisthistory[playlisthistory.length - 1].lastplayed = new Date();
            playlisthistory[playlisthistory.length - 1].duration = info.length_seconds;
            //cleanup votes
            playlisthistory[playlisthistory.length - 1].skipvote = 0;
            playlisthistory[playlisthistory.length - 1].skipvoted = [];
            playlistqueue.splice(0, 1);
            playingIntent.on('pause', ()=>{ bot.setStatus('online', 'paused.', (error) => { if(error) console.log(error); }); });
            playingIntent.on('resume', ()=>{ bot.setStatus('online', playlisthistory[playlisthistory.length - 1].title, (error) => { if(error) console.log(error); }); });
            playingIntent.on('end', playNextSong);
          }
        });
        bot.setStatus('online', info.title, (error) => { if(error) console.log(error); });
      }else{
        bot.sendMessage(playlistqueue[0].message.channel, 'Sorry, no suitable quality found :crying_cat_face: for' + info.title, { tts: false }, (error, msg) => { if(error) console.log(error); });
        playlistqueue.splice(0, 1);
        playNextSong();
      }
    });
  }
  if(playlistqueue[0].type === 'soundcloud'){
    bot.voiceConnection.playFile(playlistqueue[0].url, {
      volume : volume
    }, function (error, playingIntent){
      if (error){// on error skip the current song
        bot.sendMessage(playlistqueue[0].message.channel, 'Something went wrong :rooster: while trying to play **' + playlistqueue[0].title + '**.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        playlistqueue.splice(0, 1);
        playNextSong();
      }else{
        playlisthistory.push(playlistqueue[0]);
        playlisthistory[playlisthistory.length - 1].lastplayed = new Date();
        //cleanup votes
        playlisthistory[playlisthistory.length - 1].skipvote = 0;
        playlisthistory[playlisthistory.length - 1].skipvoted = [];
        playlistqueue.splice(0, 1);
        playingIntent.on('pause', ()=>{ bot.setStatus('online', 'paused.', (error) => { if(error) console.log(error); }); });
        playingIntent.on('resume', ()=>{ bot.setStatus('online', playlisthistory[playlisthistory.length - 1].title, (error) => { if(error) console.log(error); }); });
        playingIntent.on('end', playNextSong);
      }
    });
    bot.setStatus('online', playlistqueue[0].title, (error) => { if(error) console.log(error); });
  }
}

// adapted from http://stackoverflow.com/a/6313008
function prettifyDuration (duration){
  var sec_num = parseInt(duration, 10);
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);

  hours = (hours < 10) ? ('0' + hours) : hours;
  minutes = (minutes < 10) ? ('0' + minutes) : minutes;
  seconds = (seconds < 10) ? ('0' + seconds) : seconds;
  return ((hours < 10) ? (minutes + ':' + seconds) : (hours + ':' + minutes + ':' + seconds));
}

function hasPermission(message){
  return !(message.author.id != require(__dirname + '/permissions.json').owner && require(__dirname + '/permissions.json').mod.indexOf(message.author.id) === -1 && require(__dirname + '/permissions.json').haspermission.indexOf(message.author.id) === -1);
}

function addSoundcloudURL(soundcloudurl, msg){
  request({
    method: 'GET',
    url: 'http://api.soundcloud.com/resolve.json',
    qs: {
      url: soundcloudurl,
      client_id: config.APIKEY.SOUNDCLOUD
    }
  },
  function (error, response, body) {
    if (error || response.statusCode != 200) {bot.sendMessage(msg, 'Sorry, something went wrong :rooster:', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
    var scData = JSON.parse(body);
    if(scData.kind == 'playlist'){
      scData.tracks.forEach((track) => {
        if(track.streamable){
          playlistqueue.push({ type: 'soundcloud', url: track.stream_url + '?client_id=' + config.APIKEY.SOUNDCLOUD, message: msg, title: track.title, duration: track.duration/1000 });
        }
      });
    }
    if(scData.kind == 'track'){
      if(scData.streamable){
        playlistqueue.push({ type: 'soundcloud', url: scData.stream_url + '?client_id=' + config.APIKEY.SOUNDCLOUD, message: msg, title: scData.title, duration: scData.duration/1000 });
      }else{
        bot.reply(message, 'Could not add **' + track.title + '** to playlist.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }
    if(bot.voiceConnection === null){
      bot.reply(msg, 'Please Type **' + config.command.prefix + config.command.name + ' join** to make the bot Join a Voicechannel.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      return; // abort and wait for right request
    }
    if(bot.voiceConnection.playing){
      if(scData.kind == 'playlist'){
        bot.reply(msg, ' imported ' + scData.tracks.length + ((scData.tracks.length > 1)? ' Items' : ' Item') + ' to playlist! ' + playlistqueue.length + ' ' + ((playlistqueue.length == 1)? 'Song' : 'Songs') + ' to play.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
      else if (scData.kind == 'track') {
        bot.reply(msg, ' added to playlist! ' + playlistqueue.length + ' ' + ((playlistqueue.length == 1)? 'Song' : 'Songs') + ' in playlist.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }else{
      if(scData.kind == 'playlist'){
        bot.reply(msg, ' imported ' + scData.tracks.length + ((scData.tracks.length > 1)? ' Items' : ' Item') + ' to playlist! ' + playlistqueue.length + ' ' + ((playlistqueue.length == 1)? 'Song' : 'Songs') + ' to play.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
      playNextSong();
    }
  });
}

function addYoutubePlaylist(playlistid, msg, pagetoken) {
  request({
    method: 'GET',
    url: 'https://www.googleapis.com/youtube/v3/playlistItems',
    qs: {
      part: 'snippet',
      maxResults: 50,
      playlistId: playlistid,
      pageToken: pagetoken,
      key: config.APIKEY.YOUTUBE
    }
  },
  function (error, response, body) {
    if (error || response.statusCode != 200) {bot.sendMessage(msg, 'Sorry, something went wrong :rooster:', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
    var data = JSON.parse(body);
    data.items.forEach((item) => {
      playlistqueue.push({ type: 'youtube', url: 'https://www.youtube.com/watch?v=' + item.snippet.resourceId.videoId, message: msg, title: item.snippet.title });
    });
    if(typeof data.nextPageToken !== 'undefined'){
      addYoutubePlaylist(playlistid, msg, data.nextPageToken);
    }else{
      bot.reply(msg, ' imported ' + data.pageInfo.totalResults + ((data.pageInfo.totalResults > 1)? ' Videos' : ' Video') + ' into playlist! ' + playlistqueue.length + ' ' + ((playlistqueue.length == 1)? 'Item' : 'Items') + ' to play.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      if(bot.voiceConnection === null){
        bot.reply(msg, 'Please Type **' + config.command.prefix + config.command.name + ' join** to make the bot Join a Voicechannel.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        return; // abort and wait for right request
      }
      if(!bot.voiceConnection.playing){
        playNextSong();
      }
    }
  });
}

function messageParser(msg) {
  var args = msg.split(' ');
  args = args.map((arg) => { return arg.trim(); })
  return args;
}

function saveConfig(obj, path){
  require('fs').writeFile(path, JSON.stringify(obj), 'utf8', function (err) {
    if (err) console.log(err);
    console.log('# Permission file saved');
  });
}

//http://bost.ocks.org/mike/shuffle/
function shufflePlaylist(array) {
  var m = array.length, t, i;
  while (m) {
    i = Math.floor(Math.random() * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }
  return array;
}

function loggerOB(message) {
  var logname = (message.channel.isPrivate) ? ('PM - ' + message.channel.recipient.username) : (message.channel.server.name + ' - ' + message.channel.name);
  fs.appendFile(__dirname + '/oblog/' + logname + '.log', require('os').EOL + message.author.username + '<' + message.author.id + '>'+ ': ' + require('os').EOL + message.content, encoding='utf8', function (err) {
    if (err) console.log('# Logger Exception: ' + err);
  });
}

bot.on('message', (message) => {
  if(config.logging){ loggerOB(message); }
  var args = messageParser(message.content);

  if(args.length < 2 || args[0].toLowerCase() !== config.command.prefix + config.command.name){ return; }else{ args.shift(); }

  //TODO: check for global permission

  switch (args[0].toLowerCase()) {
    case 'join':
    if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' join**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
    if(bot.voiceConnection === null){
      if(args.length === 1){
        message.channel.server.channels.get("type", "voice").join();
      }
      if(args.length > 1){
        try{
          args.shift();
          message.channel.server.channels.get('name', args.join(' ')).join();
        }catch(er){
          bot.reply(message, 'Something went wrong while trying to join ' + args.join(' ') + '.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }
      }
    }else{
      if(args.indexOf('-f') !== -1){
        bot.leaveVoiceChannel();
        message.channel.server.channels.get("type", "voice").join();
      }else{
        bot.reply(message, 'I am already in use on another Voicechannel.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }
    break;
    case 'leave':
    if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' leave**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
    if(bot.voiceConnection !== null){
      bot.leaveVoiceChannel();
    }else{
      bot.sendMessage(message.channel,':confused: I have no active Voice connection.', { tts: false }, (error, msg) => { if(error) console.log(error); });
    }
    break;
    case 'play':
    if(bot.voiceConnection !== null){
      if(!bot.voiceConnection.paused){
        if(playlistqueue.length === 0) {
          bot.reply(message, 'Playlist empty, to add something use **' + config.command.prefix + config.command.name + ' <URL>**.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }else{
          if(bot.voiceConnection.playing){
            bot.reply(message, ' I am already playing music.', { tts: false }, (error, msg) => { if(error) console.log(error); });
          }else{
            playNextSong();
          }
        }
      }else{
        bot.voiceConnection.resume();
        bot.reply(message, ' resuming playlist. :notes:', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }else{
      bot.reply(message, 'Please Type **' + config.command.prefix + config.command.name + ' join** to make the bot Join a Voicechannel.', { tts: false }, (error, msg) => { if(error) console.log(error); });
    }
    break;
    case 'next':
    if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' next**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
    if(bot.voiceConnection !== null){
      bot.voiceConnection.stopPlaying();
    }else{
      bot.reply(message, 'I am not playing music :rooster:.', { tts: false }, (error, msg) => { if(error) console.log(error); });
    }
    break;
    case 'prev':
    if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' prev**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
    if(bot.voiceConnection !== null){
      if((playlisthistory.length - 1) != -1 && (playlisthistory.length - 2) != -1){
        playlistqueue.unshift(playlisthistory[playlisthistory.length - 1]);
        playlistqueue.unshift(playlisthistory[playlisthistory.length - 2]);
        playlisthistory.splice(playlisthistory.length - 1, 1);
        playlisthistory.splice(playlisthistory.length - 1, 1);
        bot.voiceConnection.stopPlaying();
      }else{
        bot.sendMessage(message.channel,'I am no Time Machine :(', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }
    break;
    case 'pause':
    if(bot.voiceConnection.paused){
      bot.sendMessage(message.channel,'I am already paused, use **' + config.command.prefix + config.command.name + ' resume** to resume playing.', { tts: false }, (error, msg) => { if(error) console.log(error); });
    }else{
      bot.voiceConnection.pause();
    }
    break;
    case 'resume':
    if(bot.voiceConnection.paused){
      bot.voiceConnection.resume();
    }else{
      bot.reply(message, ' I am playing music. :confused:', { tts: false }, (error, msg) => { if(error) console.log(error); });
    }
    break;
    case 'volume':
    if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' volume**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
    if(args.length >= 2){
      if(!isNaN(args[1]) && (args[1] % 1 === 0)){
        var prevvol = bot.voiceConnection.getVolume() * 100;
        var currvol = ((args[1] > 100)? 100 : ((args[1] < 0)? 0 : args[1]));
        volume = currvol / 100;
        bot.voiceConnection.setVolume(currvol / 100);
        bot.reply(message,' updated volume from ' + prevvol + ' to ' + currvol + '.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }else{
        bot.sendMessage(message.channel,':boom: Could not set volume! Invalid number.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }
    break;
    case 'list':
    if(bot.voiceConnection !== null){
      if(args.length > 1){
        if(args[1].toLowerCase() === 'clear'){ // clear the playlist
          if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' list clear**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
          playlistqueue = [];
          //bot.voiceConnection.stopPlaying();
          bot.sendMessage(message.channel,'Playlist cleared :smile:', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }
        if(args[1].toLowerCase() === 'all'){
          var playlistText = '```# Current Playlist #' + require('os').EOL;
          if(bot.voiceConnection.playing) {
            playlistText += '-> ' + playlisthistory[playlisthistory.length - 1].title + require('os').EOL;
          }
          if(playlistqueue.length !== 0) {
            for (var i = 0; i < playlistqueue.length; i++) {
              playlistText += (i+1) + '. ' + playlistqueue[i].title + require('os').EOL;
              if(playlistText.length > 1500){
                playlistText += 'And ' + (playlistqueue.length - (i+1)) + ' more Items ...' + require('os').EOL;
                break;
              }
            }
            playlistText += 'Playlist END' + require('os').EOL;
          }else{
            if(!bot.voiceConnection.playing){
              playlistText += 'Playlist EMPTY' + require('os').EOL;
            }else{
              playlistText += 'Playlist END' + require('os').EOL;
            }
          }
          playlistText += '```';
          bot.sendMessage(message.channel, playlistText, { tts: false }, (error, msg) => { if(error) console.log(error); });
        }
      }
    }else{
      if(args.length > 1){
        if(args[1].toLowerCase() === 'clear'){
          if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' list clear**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
          playlistqueue = [];
          bot.sendMessage(message.channel,'Playlist cleared :smile:', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }
      }
    }
    if(args.length > 1){
      if(args[1].toLowerCase() === 'shuffle'){
        playlistqueue = shufflePlaylist(playlistqueue);
        bot.sendMessage(message.channel,'Shuffle, Shuffle! :space_invader:', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
      if(args[1].toLowerCase() === 'history' && args.length === 2){
        if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' list history**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
        var playlistText = '```# Playlist History #' + require('os').EOL;
        if(playlisthistory.length !== 0) {
          for (var i = 0; i < playlisthistory.length; i++) {
            playlistText += (i+1) + '. [' + playlisthistory[i].lastplayed.toLocaleString() + '] ' + playlisthistory[i].title + require('os').EOL;
            if(playlistText.length > 1500){
              playlistText += 'And ' + (playlisthistory.length - (i+1)) + ' more Items ...' + require('os').EOL;
              break;
            }
          }
          playlistText += 'History END' + require('os').EOL;
        }else{
          playlistText += 'You haven\'t played any music recently.' + require('os').EOL;
        }
        playlistText += '```';
        bot.sendMessage(message.channel, playlistText, { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }
    if(args.length === 3){
      if(args[1].toLowerCase() === 'remove'){
        if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' list remove**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
        var plremove = args[2];
        if(!isNaN(plremove) && (plremove % 1 === 0) && plremove <= playlistqueue.length && plremove > 0){
          playlistqueue.splice((plremove-1), 1);
          bot.sendMessage(message.channel, ':ocean: Item ' + plremove + ' washed away.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }else{
          bot.sendMessage(message.channel,':boom: Playlist Item not found!', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }
      }
      if(args[1].toLowerCase() === 'history' && args[2].toLowerCase() === 'clear'){
        if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' list history clear**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
        playlisthistory.splice(0, playlisthistory.length - 1);
        bot.sendMessage(message.channel,'History cleared :smile:', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }
    break;
    case 'info':
    if(bot.voiceConnection !== null){
      if(bot.voiceConnection.playing) {
        bot.sendMessage(message.channel,'Now Playing **' + playlisthistory[playlisthistory.length - 1].title + '** `' + prettifyDuration(bot.voiceConnection.streamTime/1000) + '/' + prettifyDuration(playlisthistory[playlisthistory.length - 1].duration) + '`', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }else{
        bot.reply(message, 'Please Type **' + config.command.prefix + config.command.name + ' play** to make the bot play.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }else{
      bot.reply(message, 'Please Type **' + config.command.prefix + config.command.name + ' join** to make the bot Join a Voicechannel.', { tts: false }, (error, msg) => { if(error) console.log(error); });
    }
    break;
    case 'skip':
    if(bot.voiceConnection !== null){
      if(bot.voiceConnection.playing) {
        if(typeof playlisthistory[playlisthistory.length -1].skipvote === 'undefined' || playlisthistory[playlisthistory.length -1].skipvote > config.community.skipvote || typeof playlisthistory[playlisthistory.length -1].skipvoted === 'undefined'){
          playlisthistory[playlisthistory.length -1].skipvote = 0;
          playlisthistory[playlisthistory.length -1].skipvoted = [];
        }
        if(bot.voiceConnection.voiceChannel.members.indexOf(message.author) === -1){
          bot.reply(message, ' to be able to vote you have to be in the Voicechannel where ' + bot.user.username + ' is.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }else if(playlisthistory[playlisthistory.length -1].skipvoted.indexOf(message.author.id) === -1){
          playlisthistory[playlisthistory.length -1].skipvote++;
          playlisthistory[playlisthistory.length -1].skipvoted.push(message.author.id);
          bot.reply(message, ' got ' + playlisthistory[playlisthistory.length -1].skipvote + ' out of ' + config.community.skipvote + ' required ' + ((config.community.skipvote > 1) ? 'Votes' : 'Vote') + ' to skip.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }else {
          bot.reply(message, ' you have already voted.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }
        if((playlisthistory[playlisthistory.length -1].skipvote === (bot.voiceConnection.voiceChannel.members.length-1)) || (playlisthistory[playlisthistory.length -1].skipvote === config.community.skipvote)){
          playlisthistory[playlisthistory.length -1].skipvote = 0;
          playlisthistory[playlisthistory.length -1].skipvoted = [];
          bot.voiceConnection.stopPlaying();
          bot.sendMessage(message.channel,'Playing next song **' + playlisthistory[playlisthistory.length -1].title + '**.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }
      }else{
        bot.reply(message, 'Please Type **' + config.command.prefix + config.command.name + ' play** to make the bot play music.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }else{
      bot.reply(message, 'Please Type **' + config.command.prefix + config.command.name + ' join** to make the bot Join a Voicechannel.', { tts: false }, (error, msg) => { if(error) console.log(error); });
    }
    break;
    case 'diag':
    if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' diag**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
    var diagresponse = ('```' + require('os').EOL);
    diagresponse += '# Diagnostic Information #' + require('os').EOL;
    diagresponse += require(__dirname + '/package.json').name + ' v' + require(__dirname + '/package.json').version + require('os').EOL;
    diagresponse += 'Bot uptime: ' + process.uptime() + 'sec' + require('os').EOL;
    diagresponse += 'Bot username: ' + bot.user.username + require('os').EOL;
    diagresponse += 'Logged in since: ' + (bot.uptime/1000) + 'sec' + require('os').EOL;
    diagresponse += 'Load Average ' +  require('os').loadavg()[0].toFixed(4) + ' ' +  require('os').loadavg()[1].toFixed(4) + ' ' + require('os').loadavg()[2].toFixed(4) + require('os').EOL;
    diagresponse += 'RAM usage: System -> ' + (100 - (require('os').freemem()/require('os').totalmem())*100).toFixed(2) + '%, Bot -> ' + ((process.memoryUsage().rss/require('os').totalmem())*100).toFixed(2) + '%' + require('os').EOL;
    diagresponse += 'Total songs played: ' + playlisthistory.length + require('os').EOL;
    diagresponse += 'Songs in Playlist: ' + playlistqueue.length + require('os').EOL;
    diagresponse += '```';

    bot.sendMessage(message.channel, diagresponse, { tts: false }, (error, msg) => { if(error) console.log(error); });
    break;
    case 'help':
    bot.sendMessage(message.channel, 'PMing ' + message.author.username + ' the command list.', { tts: false }, (error, msg) => { if(error) console.log(error); });
    var helpreply = '__**Help Information**__' + require('os').EOL;

    helpreply += require('os').EOL + ':musical_note: ***General Commands (for everyone)*** :musical_note:' + require('os').EOL;
    //helpreply += '`' + config.command.prefix + config.command.name + '`' + ' ' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' <URL>`' + ' Adds a song or imports a playlist (supports Soundcloud and Youtube)' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' play`' + ' Starts the playlist' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' skip`' + ' Starts a community Vote to skip current song (requires at least ' + config.community.skipvote + ((config.community.skipvote > 1) ? ' Votes' : ' Vote') + ')' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' info`' + ' Display playing song Information' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' help`' + ' Sends this Help message as PM' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' diag`' + ' Displays Diagnostic Information' + require('os').EOL;

    helpreply += require('os').EOL + '***Playelist Controls***' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' list all`' + ' Lists all playlist Items' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' list shuffle`' + ' Randomly shuffles all playlist Items' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' list clear`' + ' Empties complete playlist *(requires permission)*' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' list remove <#Nr>`' + ' Remove a playlist Item *(requires permission)*' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' list history`' + ' Lists all past playlist items (requires permission)' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' list history clear`' + ' Wipes complete playlist histroy (requires permission)' + require('os').EOL;

    helpreply += require('os').EOL + '***Player Controls (requires mod rights)***' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' next`' + ' Jump to next item in Playlist *(requires permission)*' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' prev`' + ' Jump to previous item in Playlist *(requires permission)*' + require('os').EOL;

    helpreply += require('os').EOL + '***Voicechannel Management (requires mod rights)***' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' join`' + ' Make ' + bot.user.username + ' Join a Server Voicechannel' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' join <channelname>`' + ' Make ' + bot.user.username + ' Join a specific Server Voicechannel' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' leave`' + ' Disconnect ' + bot.user.username + ' from Voicechannel' + require('os').EOL;

    helpreply += require('os').EOL + '***Permission Grant/Revoke (requires mod rights)***' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' grant @username`' + ' Grants User with Player Contorl rights' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' revoke @username`' + ' Takes away Player Contorl rights' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' grant mod @username`' + ' Gives User mod rights' + require('os').EOL;
    helpreply += '`' + config.command.prefix + config.command.name + ' revoke mod @username`' + ' removes User mod rights' + require('os').EOL;

    helpreply += require('os').EOL + '*Bot may go offline without prior notice at any time for updates, testing, technical issues or other reasons.*' + require('os').EOL;
    helpreply += require('os').EOL + '*No Video, Audio and/or Images are stored by the Bot.*' + require('os').EOL;

    bot.sendMessage(message.author, helpreply, { tts: false }, (error, msg) => { if(error) console.log(error); });
    break;
    case 'grant':
    if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' grant**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
    if((message.author.id == require(__dirname + '/permissions.json').owner || require(__dirname + '/permissions.json').mod.indexOf(message.author.id) !== -1) && args.join(' ').toLowerCase().indexOf('grant') === 0 && args.join(' ').toLowerCase().indexOf('grant mod') !== 0){
      message.mentions.forEach((element, index, array) => {
        if(require(__dirname + '/permissions.json').haspermission.indexOf(element.id) === -1){
          require(__dirname + '/permissions.json').haspermission.push(element.id);
        }
      });
      saveConfig(require(__dirname + '/permissions.json'), __dirname + '/permissions.json');
    }

    if(message.author.id == require(__dirname + '/permissions.json').owner && args.join(' ').toLowerCase().indexOf('grant mod') === 0){
      message.mentions.forEach((element, index, array) => {
        if(require(__dirname + '/permissions.json').mod.indexOf(element.id) === -1){
          require(__dirname + '/permissions.json').mod.push(element.id);
        }
      });
      saveConfig(require(__dirname + '/permissions.json'), __dirname + '/permissions.json');
    }
    break;
    case 'revoke':
    if(!hasPermission(message)){ bot.reply(message, ' you don\'t have permission to use **' + config.command.prefix + config.command.name + ' revoke**.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
    if((message.author.id == require(__dirname + '/permissions.json').owner || require(__dirname + '/permissions.json').mod.indexOf(message.author.id) !== -1) && args.join(' ').toLowerCase().indexOf('revoke') === 0 && args.join(' ').toLowerCase().indexOf('revoke mod') !== 0){
      message.mentions.forEach((element, index, array) => {
        if(require(__dirname + '/permissions.json').haspermission.indexOf(element.id) !== -1){
          require(__dirname + '/permissions.json').haspermission.splice(array.indexOf(element.id), 1);
        }
      });
      saveConfig(require(__dirname + '/permissions.json'), __dirname + '/permissions.json');
    }

    if(message.author.id == require(__dirname + '/permissions.json').owner && args.join(' ').toLowerCase().indexOf('revoke mod') === 0){
      message.mentions.forEach((element, index, array) => {
        if(require(__dirname + '/permissions.json').mod.indexOf(element.id) !== -1){
          require(__dirname + '/permissions.json').mod.splice(array.indexOf(element.id), 1);
        }
      });
      saveConfig(require(__dirname + '/permissions.json'), __dirname + '/permissions.json');
    }
    break;
    default:
    var url = urljs.parse(args[0], true);
    //console.log(JSON.stringify(url));
    if(url.hostname === 'youtu.be' || url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com' || url.hostname === 'www.youtu.be'){
      if(!url.query.list && !url.query.v && url.hostname !== 'youtu.be'){
        bot.sendMessage(message.channel,'This is not a valid Youtube URL :confused:', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
      if(url.query.list){
        addYoutubePlaylist(url.query.list, message, undefined);
      }
      if((url.query.v && !url.query.list) || url.hostname === 'youtu.be'){
        try {
          ytdl.getInfo(args[0], (error, info) => {
            if (error || typeof info === 'undefined') { bot.sendMessage(message.channel, 'Sorry, something went wrong :rooster:', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }
            playlistqueue.push({ type: 'youtube', url: args[0], message: message, title: info.title, duration: info.length_seconds });
            if(bot.voiceConnection === null){
              bot.reply(message, 'Please Type **' + config.command.prefix + config.command.name + ' join** to make the bot Join a Voicechannel.', { tts: false }, (error, msg) => { if(error) console.log(error); });
              return; // abort and wait for right request
            }
            if(bot.voiceConnection.playing){
              bot.reply(message, ' added to playlist! ' + playlistqueue.length + ' ' + ((playlistqueue.length == 1)? 'Video' : 'Videos') + ' in playlist.', { tts: false }, (error, msg) => { if(error) console.log(error); });
            }else{
              playNextSong();
            }
          });
        } catch (e) {
          bot.sendMessage(message.channel, 'This is not a valid Youtube URL :confused:', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }
      }
    }
    if(url.hostname === 'soundcloud.com'){
      addSoundcloudURL(args[0], message);
    }
    break;
  }
});
