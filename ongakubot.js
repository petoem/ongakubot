var Discord = require('discord.js');
var bot = new Discord.Client({ autoReconnect: true });

var fs = require('fs');
var OPlayer = require('./player.js');

var config = require(__dirname + '/config.json');

bot.on('ready', () => {
  bot.setStatus('online', null, (error) => { if(error) console.log(error); });
  console.log('# ongaku is ready');
  setInterval(() => {
    if(bot.voiceConnections.get("playing", true)){
      bot.setStatus('online', 'music in ' + bot.voiceConnections.filter((v) => { return v.playing; }).length + ((bot.voiceConnections.filter((v) => { return v.playing; }).length == 1)? ' channel' : ' channels'), (error) => { if(error) console.log(error); });
    }else{
      bot.setStatus('idle', null, (error) => { if(error) console.log(error); });
    }
  }, 15000);
});

bot.on('error', (error) => {
  console.log(error);
});

bot.on('disconnected', () => {
  console.log('# Disconnected');
});

if(typeof config.login.withToken === 'undefined' || config.login.withToken == "" || config.login.withToken == "BOT_ACCOUNT_TOKEN") {
  bot.login(config.login.email, config.login.password, (error, token) => {
  if(error){ console.log(error); return; }
  console.log('# Connecting ...');
  });
}else{
  bot.loginWithToken(config.login.withToken, (error, token) => {
    if(error){ console.log(error); return; }
    console.log('# Connecting ...');
  });
}

function messageParser(msg) {
  var args = msg.split(' ');
  args = args.map((arg) => { return arg.trim(); })
  return args;
}

function isWhiteBlacklist(id) {
  return (config.server.whitelist.indexOf(id) !== -1 && config.server.wenabled) || (config.server.blacklist.indexOf(id) === -1 && config.server.benabled);
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

  if(!isWhiteBlacklist(message.channel.server.id)){ bot.reply(message, ' server not found in whitelist or blacklist.', { tts: false }, (error, msg) => { if(error) console.log(error); }); return; }

  switch (args[0].toLowerCase()) {
    case 'join':
    if(!bot.voiceConnections.get("server", message.channel.server)){
      if(args.length === 1){
        message.channel.server.channels.get("type", "voice").join();
        message.channel.server.player = message.channel.server.player || new OPlayer(bot, config, message.channel.server);
      }
      if(args.length > 1){
        try{
          args.shift();
          message.channel.server.channels.get('name', args.join(' ')).join();
          message.channel.server.player = message.channel.server.player || new OPlayer(bot, config, message.channel.server);
        }catch(er){
          bot.reply(message, 'Something went wrong while trying to join ' + args.join(' ') + '.', { tts: false }, (error, msg) => { if(error) console.log(error); });
        }
      }
    }else{
      if(args.indexOf('-f') !== -1){
        bot.leaveVoiceChannel(bot.voiceConnections.get("server", message.channel.server).voiceChannel, (error) => { if(error) console.log(error); });
        message.channel.server.channels.get("type", "voice").join();
      }else{
        bot.reply(message, ' i am already in use on another Voicechannel.', { tts: false }, (error, msg) => { if(error) console.log(error); });
      }
    }
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
    default:
    if(bot.voiceConnections.get("server", message.channel.server) || message.channel.server.hasOwnProperty('player')){
      message.channel.server.player.onMessage(message, args);
    }
    break;
  }
});
