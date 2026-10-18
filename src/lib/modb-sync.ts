import { saveSocialStats, getToday } from '@/lib/db';
import { fetchSyncHtml } from '@/lib/content-sync';
import { parse, type Expression, type ObjectExpression, type Property } from 'acorn';
import { load } from 'cheerio';

const PLATFORM = 'modb';

export interface ModbUserStats {
  followers: number;
  posts: number;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  subscribers: number;
  video_views: number;
}

function propertyName(property: Property): string | undefined {
  if (property.computed || property.kind !== 'init' || property.method) return undefined;
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') return property.key.value;
  return undefined;
}

function findUserTotal(node: Expression): ObjectExpression | null {
  if (node.type === 'ObjectExpression') {
    for (const property of node.properties) {
      if (property.type !== 'Property' || propertyName(property) === undefined) continue;
      if (propertyName(property) === 'userTotal') {
        if (property.value.type !== 'ObjectExpression') throw new Error('Invalid Modb userTotal state');
        return property.value;
      }
      const nested = findUserTotal(property.value);
      if (nested) return nested;
    }
  } else if (node.type === 'ArrayExpression') {
    for (const element of node.elements) {
      if (!element || element.type === 'SpreadElement') continue;
      const nested = findUserTotal(element);
      if (nested) return nested;
    }
  }
  return null;
}

function nuxtAssignment(expression: Expression): Expression | null {
  if (expression.type === 'SequenceExpression') {
    for (const item of expression.expressions) {
      const state = nuxtAssignment(item);
      if (state) return state;
    }
  }
  if (expression.type !== 'AssignmentExpression' || expression.operator !== '=') return null;
  const target = expression.left;
  if (target.type !== 'MemberExpression' || target.object.type !== 'Identifier' || target.object.name !== 'window') return null;
  const name = target.computed
    ? target.property.type === 'Literal' && target.property.value
    : target.property.type === 'Identifier' && target.property.name;
  return name === '__NUXT__' ? expression.right : null;
}

export function parseModbAuthorState(html: string): ModbUserStats | null {
  const $ = load(html);
  let state: Expression | null = null;
  for (const script of $('script').toArray()) {
    const source = $(script).html() || '';
    if (!source.includes('__NUXT__')) continue;
    let program;
    try {
      program = parse(source, { ecmaVersion: 'latest' });
    } catch {
      throw new Error('Could not parse Modb Nuxt state');
    }
    for (const statement of program.body) {
      if (statement.type === 'ExpressionStatement') state = nuxtAssignment(statement.expression) || state;
    }
  }
  if (!state) return null;

  const aliases = new Map<string, Expression>();
  if (state.type === 'CallExpression') {
    const invocation = state;
    const fn = invocation.callee;
    if (fn.type !== 'FunctionExpression' || fn.body.body.length !== 1 || fn.body.body[0].type !== 'ReturnStatement') {
      throw new Error('Unsupported Modb Nuxt state function');
    }
    const returned = fn.body.body[0].argument;
    if (!returned) throw new Error('Missing Modb Nuxt return value');
    fn.params.forEach((parameter, index) => {
      const argument = invocation.arguments[index];
      if (parameter.type !== 'Identifier' || argument?.type === 'SpreadElement') {
        throw new Error('Unsupported Modb Nuxt arguments');
      }
      if (argument) aliases.set(parameter.name, argument);
    });
    state = returned;
  }
  const total = findUserTotal(state);
  if (!total) return null;
  const fields = new Map<string, Expression>();
  for (const property of total.properties) {
    if (property.type !== 'Property') throw new Error('Unsupported Modb userTotal spread');
    const name = propertyName(property);
    if (name === undefined) throw new Error('Unsupported Modb userTotal property');
    fields.set(name, property.value);
  }

  // Read numeric literals only. Never evaluate functions, coercions, or upstream JS.
  function numberField(name: string): number {
    let node = fields.get(name);
    if (node?.type === 'Identifier') node = aliases.get(node.name);
    const value = node?.type === 'Literal' ? node.value : undefined;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid or missing Modb metric: ${name}`);
    }
    return value;
  }

  return {
    followers: numberField('follows'),
    posts: numberField(fields.has('knowledges') ? 'knowledges' : 'contents'),
    views: numberField('totalViews'),
    likes: numberField('likeds'),
    shares: numberField('stars'),
    comments: numberField('commentCount'),
    subscribers: 0,
    video_views: 0,
  };
}

export async function scrapeModb(userId: string = '471017'): Promise<{
  success: boolean;
  stats?: ModbUserStats;
  error?: string;
}> {
  const url = `https://www.modb.pro/u/${userId}`;

  console.log(`Starting 墨天轮 sync for user: ${userId}`);

  try {
    const html = await fetchSyncHtml(url);
    const stats = parseModbAuthorState(html);

    if (!stats) {
      return { success: false, error: 'Could not extract user stats from page' };
    }

    console.log('Extracted stats:', JSON.stringify(stats, null, 2));

    const today = getToday();

    await saveSocialStats({
      date: today,
      platform: PLATFORM,
      followers: stats.followers,
      posts: stats.posts,
      views: stats.views,
      likes: stats.likes,
      shares: stats.shares,
      comments: stats.comments,
      subscribers: stats.subscribers,
      video_views: stats.video_views
    });

    console.log(`墨天轮 sync complete for ${today}`);

    return { success: true, stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('墨天轮 sync error:', message);
    return { success: false, error: message };
  }
}
