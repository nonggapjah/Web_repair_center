export async function sendLineNotify(message: string) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetConfig = process.env.LINE_TARGET_ID;

    if (!token || !targetConfig) {
        console.warn('No LINE_CHANNEL_ACCESS_TOKEN or LINE_TARGET_ID found. Skipping LINE Notification.');
        return;
    }

    const targets = targetConfig.split(',').map(id => id.trim()).filter(id => id);
    const isMulticast = targets.length > 1;

    try {
        await fetch(`https://api.line.me/v2/bot/message/${isMulticast ? 'multicast' : 'push'}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                to: isMulticast ? targets : targets[0],
                messages: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            })
        });
    } catch (e) {
        console.error('Error sending LINE Notify', e);
    }
}
