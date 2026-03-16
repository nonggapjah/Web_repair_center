"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import liff from '@line/liff';

interface LiffContextType {
    liff: typeof liff | null;
    profile: any | null;
    error: string | null;
    isReady: boolean;
}

const LiffContext = createContext<LiffContextType>({
    liff: null,
    profile: null,
    error: null,
    isReady: false
});

export const useLiff = () => useContext(LiffContext);

export const LiffProvider = ({ children }: { children: React.ReactNode }) => {
    const [liffObject, setLiffObject] = useState<typeof liff | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const initLiff = async () => {
            const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
            if (!liffId) {
                console.warn("LIFF ID is missing in environment variables.");
                setIsReady(true);
                return;
            }

            try {
                await liff.init({ liffId });
                setLiffObject(liff);

                if (liff.isLoggedIn()) {
                    const userProfile = await liff.getProfile();
                    setProfile(userProfile);
                }
                setIsReady(true);
            } catch (err: any) {
                console.error("LIFF initialization failed", err);
                setError(err.message);
                setIsReady(true);
            }
        };

        initLiff();
    }, []);

    return (
        <LiffContext.Provider value={{ liff: liffObject, profile, error, isReady }}>
            {children}
        </LiffContext.Provider>
    );
};
