import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Loop through all events from LINE Webhook
        for (const event of body.events || []) {
            if (event.source && event.source.type === 'group') {
                console.log('============= LINE GROUP ID FOUND =============');
                console.log('Group ID:', event.source.groupId);
                console.log('===============================================');
            } else if (event.source && event.source.type === 'user') {
                console.log('============= LINE USER ID FOUND ==============');
                console.log('User ID:', event.source.userId);
                console.log('===============================================');
            }
        }

        return NextResponse.json({ status: 'success' }, { status: 200 });
    } catch (error) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
