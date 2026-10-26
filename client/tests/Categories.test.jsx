import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Categories from '../src/pages/Categories.jsx';
import { categoriesApi } from '@/api/categories';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/api/categories', () => ({
  categoriesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Categories Page', () => {
  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  it('renders categories list and allows creating a new category', async () => {
    const mockCategories = [
      { _id: 'cat-1', name: 'Groceries', type: 'expense', color: '#ef4444', isDefault: true },
      { _id: 'cat-2', name: 'Salary', type: 'income', color: '#22c55e', isDefault: true },
    ];
    categoriesApi.list.mockResolvedValue(mockCategories);
    categoriesApi.create.mockResolvedValue({
      _id: 'cat-3',
      name: 'Gym',
      type: 'expense',
      color: '#ef4444',
      isDefault: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Categories />
      </QueryClientProvider>
    );

    // Verify existing categories render
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    // Click Add Category button
    await userEvent.click(screen.getByRole('button', { name: /add category/i }));

    // Modal should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add Category' })).toBeInTheDocument();

    // Type category name
    const input = screen.getByLabelText('Name');
    await userEvent.type(input, 'Gym');

    // Click submit button
    const btn = screen.getByRole('button', { name: /create category/i });
    await userEvent.click(btn);




    // Verify categoriesApi.create was called with expected payload
    await waitFor(() => {
      expect(categoriesApi.create).toHaveBeenCalled();
    });

    expect(categoriesApi.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: 'Gym',
        type: 'expense',
        color: '#ef4444',
      })
    );

    expect(toast.success).toHaveBeenCalledWith('Category "Gym" created successfully!');
  });

  it('allows deleting a custom category and shows default badge for default categories', async () => {
    const mockCategories = [
      { _id: 'cat-1', name: 'Groceries', type: 'expense', color: '#ef4444', isDefault: true },
      { _id: 'cat-3', name: 'Gym', type: 'expense', color: '#3b82f6', isDefault: false },
    ];
    categoriesApi.list.mockResolvedValue(mockCategories);
    categoriesApi.delete.mockResolvedValue({ success: true });

    render(
      <QueryClientProvider client={queryClient}>
        <Categories />
      </QueryClientProvider>
    );

    // Verify Default badge appears
    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
      expect(screen.getByText('Gym')).toBeInTheDocument();
    });

    // Delete custom category
    const deleteBtn = screen.getByRole('button', { name: 'Delete Gym' });
    await userEvent.click(deleteBtn);

    // Modal opens
    expect(screen.getByRole('heading', { name: 'Delete Category' })).toBeInTheDocument();

    // Click confirm delete
    const confirmBtn = screen.getByRole('button', { name: 'Delete Category' });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(categoriesApi.delete).toHaveBeenCalledWith('cat-3');
    });

    expect(toast.success).toHaveBeenCalledWith('Category "Gym" deleted!');
  });
});
