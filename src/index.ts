import {Telegraf, Context as TelegrafContext} from 'telegraf';
import botReplies from './bot-replies';
import * as dotenv from 'dotenv';
import isEmail from 'validator/lib/isEmail';

import { MongoClient } from 'mongodb';
import { session } from 'telegraf-session-mongodb';

if (process.env.NODE_ENV !== 'production') {
	dotenv.config();
}

interface ITelegrafSession {
	userName?: string;
	userEmail?: string;
	stage?: number;
}

interface CustomContext extends TelegrafContext {
	session: ITelegrafSession;
}

const bot = new Telegraf<CustomContext>(String(process.env.BOT_TOKEN));
const mongoClient = new MongoClient(String(process.env.MONGO_URI));

async function main(bot: Telegraf<CustomContext>, mongoClient: MongoClient) {
	try {
		await mongoClient.connect();
		const db = mongoClient.db('sessionsDB');

		bot.use(session(db, { collectionName: 'sessions' }));

		bot.start(async (ctx) => {
			if (!ctx.session.userName || !ctx.session.userEmail) {
				await ctx.reply(botReplies.onStartHello);
				await ctx.reply(botReplies.onStartInputName);
			}
		});

		bot.command('remove', async (ctx) => {
			await ctx.replyWithMarkdownV2(botReplies.removingUserData.replace('{{session}}', JSON.stringify(ctx.session)));
			ctx.session = {};
		});

		bot.on('text', async (ctx, next) => {
			if (ctx.session.userName || ctx.session.userEmail) {
				return next();
			}

			ctx.session.userName = ctx.message.text;
			await ctx.reply(botReplies.onStartInputEmail);
		});

		bot.on('text', async (ctx, next) => {
			if (!ctx.session.userName || ctx.session.userEmail) {
				return next();
			}

			if (isEmail(ctx.message.text)) {
				ctx.session.userEmail = ctx.message.text;
				ctx.session.stage = 1;
				await ctx.reply(botReplies.onStartAbout);
				await ctx.reply(botReplies.onStartMotivation);
				await ctx.replyWithVideo('BAACAgIAAxkBAAP3Y16TWwk72ORXPN_6DP8a1juqrqAAAqIdAALIH_lKWITCN_OlVUoqBA');
			} else {
				await ctx.reply(botReplies.emailError);
			}
		});
		await bot.launch();
	} catch (error) {
		console.error(error);
	}
}


void main(bot, mongoClient);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
