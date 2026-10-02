<?php

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

uses(LazilyRefreshDatabase::class);

it('registers a user and returns a bearer token', function () {
    $response = $this->postJson('/api/auth/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response
        ->assertCreated()
        ->assertJsonStructure(['access_token', 'token_type', 'expires_in'])
        ->assertJsonPath('token_type', 'bearer')
        ->assertCookie('token');

    expect($response->getCookie('token', false)->isHttpOnly())->toBeTrue();

    $this->assertDatabaseHas('users', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
    ]);
});

it('returns validation errors when registration details are missing', function () {
    $this->postJson('/api/auth/register')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name', 'email', 'password']);
});

it('rejects invalid login credentials', function () {
    User::factory()->create([
        'email' => 'jane@example.com',
        'password' => 'password',
    ]);

    $this->postJson('/api/auth/login', [
        'email' => 'jane@example.com',
        'password' => 'incorrect-password',
    ])
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Invalid credentials.');
});

it('authenticates a user automatically from the login cookie', function () {
    $user = User::factory()->create([
        'email' => 'jane@example.com',
        'password' => 'password',
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'jane@example.com',
        'password' => 'password',
    ])->assertOk()->assertCookie('token');

    $this->withCookie('token', $response->json('access_token'))
        ->getJson('/api/auth/me')
        ->assertOk()
        ->assertJsonPath('id', $user->id)
        ->assertJsonPath('email', 'jane@example.com');
});

it('rejects unauthenticated requests to protected endpoints', function () {
    $this->getJson('/api/auth/me')->assertUnauthorized();
});
