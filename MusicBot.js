//이 봇의 저작권은 Heasy Official에게 있습니다
//봇의 수정,2차배포는 본 개발자 Soulkirs.#0001에게 문의해 주십시요



const { Client, Util, } = require('discord.js');
const { PREFIX, GOOGLE_API_KEY, OWNERS } = require('./config');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');
const VERSION = '0.0.2';
var os = require('os')


const client = new Client({ disableEveryone: true });

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map();

console.log('음악봇 버전:' + VERSION);
console.log('The bots copyright is Heasy Official.\n 봇의 저작권은 Heasy Official 에게 있습니다.\n');
console.log('----------------------------------------------');


client.on('ready', function() {
	console.log('[META][정보] 디스코드 API와 연결중입니다.\n');
	console.log('[META][정보] Discord API 서비스와의 연결을 성공했습니다!');
	console.log(`[META][정보] ${client.users.size} 명의 유저와, ${client.channels.size} 개의 채팅 채널과 ${client.guilds.size} 개의 서버와 함께합니다!`);
	console.log('[META][정보] 소유자 : ' + OWNERS)
	client.user.setActivity(`*help로 Kris를 알아보세요!`)
});

client.on('disconnected', function() {
    console.log('[META][경고] Discord API 서비스와의 연결이 끊어졌습니다. 다시 연결하려고합니다 ...');
});

client.on('warn', function(msg) {
    console.log('[META][경고] ' + msg);
});

client.on('error', function(err) {
	console.log('[META][에러] ' + err.message);
	process.exit(1);
});
	
	

client.on('disconnect', () => console.log('방금 연결을 끊었습니다. 이제 다시 연결하겠습니다 ...'));

client.on('reconnecting', () => console.log('지금 다시 연결 중입니다!\n'));

client.on('message', msg => {
	if (msg.content === PREFIX + 'help') {
	  msg.reply('사용가능한 명령어에요!\nplay - 노래를 재생할수있어요!\nskip - 노래를 스킵해요!\nstop - 모든 노래를 스킵해요!\nqueue - 재생목록을 보여줘요!\nnp - 현재 재생중인 곡을 보여줘요!\nvolume - 봇의 음량을 정할수있어요!\npauese - 곡을 일시정지해요!\nresume - 곡을 반복해요!');
	}
  });

client.on('message', async msg => { 
	if (msg.author.bot) return undefined;
	if (!msg.content.startsWith(PREFIX)) return undefined;

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
	command = command.slice(PREFIX.length)

	if (command === 'play') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('퍼엉...문제가 발생했어요.: 음악을 재생하려면 음성 채널에 있어야합니다!');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('퍼엉...문제가 발생했어요.:연결 권한이 없어 연결할수없어요!');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('퍼엉...문제가 발생했어요.:제게 말할 권한이 없어요!');
		}

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); 
				await handleVideo(video2, msg, voiceChannel, true); 
			}
			return msg.channel.send(`✅ 재생 목록: **${playlist.title}** 노래가 추가됬어요!`);
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
__**노래 목록:**__

${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}

1-10 범위의 검색 결과 중 하나를 선택하려면 값을 입력하세요!
					`);
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send('비디오 선택을 취소하여 값을 입력하지 않거나 유효하지 않습니다.');
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send('🆘 검색 결과를 얻을 수 없습니다.');
				}
			}
			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === 'skip') {
		if (!msg.member.voiceChannel) return msg.channel.send('음성 채널이 아닙니다!');
		if (!serverQueue) return msg.channel.send('제가 당신을 위해 건너 뛸 수있는 노래가 없습니다.');
		serverQueue.connection.dispatcher.end('Skip command has been used!');
		return undefined;
	} else if (command === 'stop') {
		if (!msg.member.voiceChannel) return msg.channel.send('음성 채널이 아닙니다!');
		if (!serverQueue) return msg.channel.send('제가 당신을 위해 멈출 수있는 것은 아무것도 없습니다.');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('정지 명령이 사용되었습니다!');
		return undefined;
	} else if (command === 'volume') {
		if (!msg.member.voiceChannel) return msg.channel.send('음성 채널이 아닙니다!');
		if (!serverQueue) return msg.channel.send('아무것도 재생되지 않습니다.');
		if (!args[1]) return msg.channel.send(`현재 볼륨은: **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`음량을: **${args[1]}** + 으로 수정하였습니다!`);
	} else if (command === 'np') {
		if (!serverQueue) return msg.channel.send('아무것도 재생되고있지않습니다.');
		return msg.channel.send(`🎶 현재 재생중: **${serverQueue.songs[0].title}**`);
	} else if (command === 'queue') {
		if (!serverQueue) return msg.channel.send('아무것도 재생되고있지않습니다.');
		return msg.channel.send(`
__**노래 대기열:**__

${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}

**현재 재생중:** ${serverQueue.songs[0].title}
		`);
	} else if (command === 'pause') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('⏸ 당신을 위해 음악을 일시 중지했습니다!');
		}
		return msg.channel.send('아무것도 재생되고있지 않습니다.');
	} else if (command === 'resume') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('▶ 당신을 위해 음악을 재개했습니다!');
		}
		return msg.channel.send('아무것도 재생되고있지 않습니다.');
	}

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`I could not join the voice channel: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`음성 채널에 참여할 수 없습니다: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`✅ **${song.title}** 대기열에 추가되었습니다!`);
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === '스트림이 충분히 빠르게 생성되지 않습니다.') console.log('Song ended.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`🎶 노래가 시작됬어요!: **${song.title}**`);
}


acces.token = process.env["BOT_TOKEN"]
client.login('acces.token')
