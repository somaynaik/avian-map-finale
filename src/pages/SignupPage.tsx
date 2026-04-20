import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Check, X, Mail, Lock, User } from 'lucide-react';

const signupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

const SignupPage = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const password = watch('password', '');

  const passwordRequirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains a number', met: /\d/.test(password) },
    { label: 'Contains uppercase', met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase', met: /[a-z]/.test(password) },
  ];

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError('');
    setSuccess(false);

    const { error } = await signUp(data.email, data.password, data.username);

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      setSuccess(true);
      setIsLoading(false);
      setTimeout(() => navigate('/login'), 2000);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Column - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center items-center relative overflow-hidden bg-primary/5">
        {/* Soft Map background */}
        <div 
          className="absolute inset-0 opacity-[0.03] bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center"
          style={{ mixBlendMode: 'multiply' }}
        />
        {/* Subtle green tint overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-primary/5" />
        
        <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center max-w-lg h-full">
          <div className="mb-10">
            <img 
              src="/avian-map-final-logo.jpeg" 
              alt="Avian Map Logo" 
              className="w-48 h-auto rounded-3xl object-contain mix-blend-multiply" 
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-5 tracking-tight text-foreground drop-shadow-sm">
            Avian Map
          </h1>
          <p className="text-xl md:text-2xl text-foreground/80 font-medium leading-relaxed mb-6">
            Join thousands of bird watchers mapping sightings across India
          </p>
          <p className="text-sm text-foreground/50 font-semibold uppercase tracking-widest mt-4">
            Discover • Track • Conserve
          </p>
        </div>
      </div>

      {/* Right Column - Sign Up */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-background to-primary/[0.02]">
        
        <Card className="w-full max-w-md border-border/40 shadow-2xl shadow-primary/5 rounded-3xl relative z-10 bg-background/95 backdrop-blur my-8">
          <CardHeader className="space-y-3 pb-6 pt-8">
            <div className="flex justify-center mb-2 lg:hidden">
              <img 
                src="/avian-map-final-logo.jpeg" 
                alt="Avian Map Logo" 
                className="w-24 h-auto rounded-2xl object-contain mix-blend-multiply shadow-sm" 
              />
            </div>
            <CardTitle className="text-3xl font-extrabold text-center tracking-tight text-foreground">
              Create an account
            </CardTitle>
            <CardDescription className="text-center text-base font-medium text-muted-foreground">
              Enter your information to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 rounded-xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-emerald-500/50 bg-emerald-50/50 text-emerald-900 animate-in fade-in slide-in-from-top-2 rounded-xl">
                  <AlertDescription className="font-medium">
                    Account created! Check your email to verify. Redirecting to login...
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2.5">
                <Label htmlFor="username" className="font-semibold text-foreground/80 text-sm ml-1">Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <User className="h-5 w-5" />
                  </div>
                  <Input
                    id="username"
                    type="text"
                    placeholder="johndoe"
                    {...register('username')}
                    disabled={isLoading}
                    className="h-12 pl-11 rounded-xl transition-all border-border/50 focus-visible:border-primary/50 focus-visible:ring-primary/20 bg-background"
                  />
                </div>
                {errors.username && (
                  <p className="text-sm text-destructive font-medium ml-1">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="email" className="font-semibold text-foreground/80 text-sm ml-1">Email</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <Mail className="h-5 w-5" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    {...register('email')}
                    disabled={isLoading}
                    className="h-12 pl-11 rounded-xl transition-all border-border/50 focus-visible:border-primary/50 focus-visible:ring-primary/20 bg-background"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive font-medium ml-1">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="password" className="font-semibold text-foreground/80 text-sm ml-1">Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <Lock className="h-5 w-5" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...register('password')}
                    disabled={isLoading}
                    className="h-12 pl-11 rounded-xl transition-all border-border/50 focus-visible:border-primary/50 focus-visible:ring-primary/20 bg-background"
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive font-medium ml-1">{errors.password.message}</p>
                )}
                
                {password && (
                  <div className="space-y-1 mt-2 mb-2 ml-1">
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs font-medium">
                        {req.met ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/60" />
                        )}
                        <span className={req.met ? 'text-emerald-600' : 'text-muted-foreground/80'}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="confirmPassword" className="font-semibold text-foreground/80 text-sm ml-1">Confirm Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                    <Lock className="h-5 w-5" />
                  </div>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    {...register('confirmPassword')}
                    disabled={isLoading}
                    className="h-12 pl-11 rounded-xl transition-all border-border/50 focus-visible:border-primary/50 focus-visible:ring-primary/20 bg-background"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive font-medium ml-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold shadow-[0_4px_14px_0_rgba(var(--primary),0.25)] transition-all hover:shadow-[0_6px_20px_rgba(var(--primary),0.2)] hover:-translate-y-0.5 rounded-xl mt-4" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-6 pb-8 bg-muted/30 rounded-b-3xl border-t border-border/40">
            <div className="text-sm text-center text-muted-foreground font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-semibold hover:text-primary/80 hover:underline transition-all">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
