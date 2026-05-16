"use client"

import { loginWithGoogleCredential } from '@/utils/auth-handlers';
import { GoogleLogin } from '@react-oauth/google';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const LoginPage = () => {
    const router = useRouter();

    const onGoogleCredential = async (credential?: string) => {
        if (!credential) {
            toast.error("Google sign-in did not return a credential");
            return;
        }

        try {
            await loginWithGoogleCredential(credential);
            router.push("/onboarding");
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Google sign-in failed");
        }
    };

    return (
        <section className='flex min-h-screen bg-zinc-50 dark:bg-transparent px-4 py-16 md:py-32 '>
            <div className='bg-card m-auto h-fit w-full max-w-sm rounded-[calc(var(--radius)+.125rem)] border p-0.5 shadow-md dark:[--color-muted:var(--color-zinc-900)] '>
                <div className='p-8 pb-6'>
                    <div>
                        <Link href={"/"}>
                            <h1 className='text-2xl font-bold'>Console Me</h1>
                        </Link>
                        <h1 className='mb-1 mt-4 text-xl font-semibold'>Sign in to Console Me</h1>
                        <p className="text-sm">Welcome back! Sign in to continue</p>
                    </div>

                    <div className='mt-6 grid grid-cols-1 gap-2'>
                        <GoogleLogin
                            onSuccess={(credentialResponse) => onGoogleCredential(credentialResponse.credential)}
                            onError={() => toast.error("Google sign-in failed")}
                            useOneTap
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}

export default LoginPage;
