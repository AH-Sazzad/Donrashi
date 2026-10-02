<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $categories = $request->user()->categories()->latest()->get();

        return response()->json($categories);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'  => ['required', 'string', 'max:255'],
            'type'  => ['required', 'in:income,expense'],
            'icon'  => ['nullable', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
        ]);

        $category = $request->user()->categories()->create($validated);

        return response()->json($category, 201);
    }

    public function show(Request $request, Category $category): JsonResponse
    {
        $this->authorizeOwnership($request, $category);

        return response()->json($category);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $this->authorizeOwnership($request, $category);

        $validated = $request->validate([
            'name'  => ['sometimes', 'required', 'string', 'max:255'],
            'type'  => ['sometimes', 'required', 'in:income,expense'],
            'icon'  => ['nullable', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'regex:/^#([A-Fa-f0-9]{6})$/'],
        ]);

        $category->update($validated);

        return response()->json($category);
    }

    public function destroy(Request $request, Category $category): JsonResponse
    {
        $this->authorizeOwnership($request, $category);

        $category->delete();

        return response()->json(['message' => 'Category deleted successfully.']);
    }

    private function authorizeOwnership(Request $request, Category $category): void
    {
        if ($category->user_id !== $request->user()->id) {
            abort(403, 'This action is unauthorized.');
        }
    }
}
