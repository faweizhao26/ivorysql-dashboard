import { NextResponse } from 'next/server';
import { 
  getReminderSettings, 
  saveReminderSettings, 
  getStalePlatforms,
  updateReminderLastSent,
  logReminderSent
} from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');

  try {
    if (platform) {
      const settings = await getReminderSettings(platform) as any;
      return NextResponse.json(settings);
    }

    const settings = await getReminderSettings() as any[];
    const stalePlatforms = await getStalePlatforms();

    return NextResponse.json({
      settings,
      stalePlatforms,
      hasStaleData: stalePlatforms.length > 0
    });
  } catch (error) {
    console.error('Error fetching reminder settings:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { platform, update_frequency_days, reminder_enabled, webhook_url } = body;

    if (!platform) {
      return NextResponse.json({ error: 'Missing platform' }, { status: 400 });
    }

    await saveReminderSettings({
      platform,
      update_frequency_days: update_frequency_days || 7,
      reminder_enabled: reminder_enabled !== undefined ? (reminder_enabled ? 1 : 0) : 1,
      webhook_url
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving reminder settings:', error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { platform, action } = body;

    if (!platform || !action) {
      return NextResponse.json({ error: 'Missing platform or action' }, { status: 400 });
    }

    if (action === 'send_reminder') {
      const settings = await getReminderSettings(platform) as any;
      
      if (settings?.webhook_url) {
        try {
          const response = await fetch(settings.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🔔 数据更新提醒：${platform} 已经 ${settings.update_frequency_days} 天没有更新数据了，请及时更新！`
            })
          });

          if (response.ok) {
            await updateReminderLastSent(platform);
            await logReminderSent(platform, 'sent');
            return NextResponse.json({ success: true, message: 'Reminder sent' });
          } else {
            await logReminderSent(platform, 'failed');
            return NextResponse.json({ error: 'Failed to send webhook' }, { status: 500 });
          }
        } catch (webhookError) {
          await logReminderSent(platform, 'error');
          return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'No webhook URL configured' }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing reminder action:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}