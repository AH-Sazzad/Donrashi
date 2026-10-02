<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Tymon\JWTAuth\JWTGuard;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create($validated);

        return $this->respondWithToken($this->guard()->login($user), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! $token = $this->guard()->attempt($credentials)) {
            return response()->json(['message' => 'Invalid credentials.'], 401);
        }

        return $this->respondWithToken($token);
    }

    public function me(Request $request): JsonResponse
    {
        // First Check if the user is authenticated via the JWT token in the Authorization header
        if ($user = $request->user('api')) {
            return response()->json($user);
        }
        return response()->json(['message' => 'User not found.'], 404);
    }

    public function logout(): JsonResponse
    {
        $this->guard()->logout();

        return response()
            ->json(['message' => 'Successfully logged out.'])
            ->withoutCookie($this->cookieName(), '/', config('jwt.cookie.domain'));
    }

    public function refresh(): JsonResponse
    {
        return $this->respondWithToken($this->guard()->refresh());
    }

    private function guard(): JWTGuard
    {
        /** @var JWTGuard $guard */
        $guard = Auth::guard('api');

        return $guard;
    }

    private function respondWithToken(string $token, int $status = 200): JsonResponse
    {
        return response()
            ->json([
                'access_token' => $token,
                'token_type' => 'bearer',
                'expires_in' => $this->guard()->factory()->getTTL() * 60,
            ], $status)
            ->cookie(
                $this->cookieName(),
                $token,
                $this->guard()->factory()->getTTL(),
                '/',
                config('jwt.cookie.domain'),
                config('jwt.cookie.secure'),
                true,
                false,
                config('jwt.cookie.same_site'),
            );
    }

    private function cookieName(): string
    {
        return config('jwt.cookie.name');
    }
}
