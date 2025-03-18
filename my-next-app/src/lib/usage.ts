import { prisma } from './prisma';

export type UsageType = 'whisperMinutes' | 'gpt4Tokens' | 'gpt35Tokens';

interface UsageLimits {
    whisperMinutes: number;
    gpt4Tokens: number;
    gpt35Tokens: number;
}

const PLAN_LIMITS: Record<string, UsageLimits> = {
    free: {
        whisperMinutes: 10,    // 10분/일
        gpt4Tokens: 1000,      // 1000토큰/일
        gpt35Tokens: 5000      // 5000토큰/일
    },
    pro: {
        whisperMinutes: 60,    // 60분/일
        gpt4Tokens: 10000,     // 10000토큰/일
        gpt35Tokens: 50000     // 50000토큰/일
    },
    enterprise: {
        whisperMinutes: 300,   // 300분/일
        gpt4Tokens: 100000,    // 100000토큰/일
        gpt35Tokens: 500000    // 500000토큰/일
    }
};

export async function trackUsage(userId: string, type: UsageType, amount: number) {
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                usage: true,
                subscription: true
            }
        });

        if (!user) {
            throw new Error('사용자를 찾을 수 없습니다.');
        }

        // 사용량 업데이트
        const usage = await prisma.usage.upsert({
            where: { userId },
            create: {
                userId,
                [type]: amount,
                dailyUsage: { [today]: { [type]: amount } },
                monthlyUsage: { [month]: { [type]: amount } }
            },
            update: {
                [type]: { increment: amount },
                dailyUsage: {
                    set: {
                        ...user.usage?.dailyUsage as object,
                        [today]: {
                            ...(user.usage?.dailyUsage as any)?.[today],
                            [type]: ((user.usage?.dailyUsage as any)?.[today]?.[type] || 0) + amount
                        }
                    }
                },
                monthlyUsage: {
                    set: {
                        ...user.usage?.monthlyUsage as object,
                        [month]: {
                            ...(user.usage?.monthlyUsage as any)?.[month],
                            [type]: ((user.usage?.monthlyUsage as any)?.[month]?.[type] || 0) + amount
                        }
                    }
                },
                lastUsed: new Date()
            }
        });

        return usage;
    } catch (error) {
        console.error('사용량 추적 오류:', error);
        throw error;
    }
}

export async function checkUsageLimit(userId: string, type: UsageType, amount: number): Promise<boolean> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                usage: true,
                subscription: true
            }
        });

        if (!user || !user.subscription) {
            throw new Error('구독 정보를 찾을 수 없습니다.');
        }

        const plan = user.subscription.plan;
        const limits = PLAN_LIMITS[plan];

        if (!limits) {
            throw new Error('구독 플랜에 대한 제한을 찾을 수 없습니다.');
        }

        const today = new Date().toISOString().split('T')[0];
        const currentDailyUsage = ((user.usage?.dailyUsage as any)?.[today]?.[type] || 0) + amount;

        // 일일 한도 체크
        if (currentDailyUsage > limits[type]) {
            throw new Error(`일일 사용량 한도(${limits[type]})를 초과했습니다.`);
        }

        return true;
    } catch (error) {
        console.error('사용량 확인 오류:', error);
        throw error;
    }
}

export async function getRemainingUsage(userId: string): Promise<Partial<UsageLimits>> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                usage: true,
                subscription: true
            }
        });

        if (!user || !user.subscription) {
            throw new Error('구독 정보를 찾을 수 없습니다.');
        }

        const plan = user.subscription.plan;
        const limits = PLAN_LIMITS[plan];
        const today = new Date().toISOString().split('T')[0];
        const dailyUsage = (user.usage?.dailyUsage as any)?.[today] || {};

        return {
            whisperMinutes: limits.whisperMinutes - (dailyUsage.whisperMinutes || 0),
            gpt4Tokens: limits.gpt4Tokens - (dailyUsage.gpt4Tokens || 0),
            gpt35Tokens: limits.gpt35Tokens - (dailyUsage.gpt35Tokens || 0)
        };
    } catch (error) {
        console.error('잔여 사용량 확인 오류:', error);
        throw error;
    }
} 