# Contributing

All changes must be made through Pull Requests. Direct commits to main or release branches are not allowed.

## Versioning

We follow Semantic Versioning (SemVer) for versioning, with the format `MAJOR.MINOR.PATCH`.

- `MAJOR` - Breaking changes, incompatible API changes
- `MINOR` - New features, backward compatible
- `PATCH` - Bug fixes, no new features

## Testing

All new code must include comprehensive tests. Follow these testing guidelines:

### Test File Structure

- Test files must be named the same as the file containing the logic, but ending in `.test.ts`
- Example: `user-service.ts` → `user-service.test.ts`
- Place test files in the same directory as the source files

### Test Organization

Tests should be organized using `describe` and `it` blocks:

```typescript
describe(ClassName.name, () => {
  it('should perform expected behavior when given valid input', () => {
    // Test implementation
  });

  it('should handle specific scenario correctly', () => {
    // Test implementation
  });

  describe('[Edges]', () => {
    it('should handle null input appropriately', () => {
      // Edge case test
    });

    it('should handle undefined input appropriately', () => {
      // Edge case test
    });
  });
});
```

### Test Naming Conventions

- **Describe blocks**: Use the class name being tested. You can use `<ClassName>.name` for consistency
- **It blocks**: Write descriptive test names that start with "should" and describe the expected behavior
- **Edge cases**: Group bugs and edge cases in a separate `describe('[Edges]')` section

### Test Guidelines

1. **Single Responsibility**: Each test should verify only one specific behavior or outcome
2. **Descriptive Names**: Test names should clearly describe what functionality is being tested
3. **Behavior Testing**: Tests should verify behavior, not implementation details
4. **Edge Cases**: Handle `null`, `undefined`, and other edge cases in the `[Edges]` section
5. **Simplicity**: Keep tests simple and easy to understand

### Example

```typescript
describe(Calculator.name, () => {
  it('should add two positive numbers correctly', () => {
    const result = calculator.add(2, 3);
    expect(result).toBe(5);
  });

  it('should add negative numbers correctly', () => {
    const result = calculator.add(-2, -3);
    expect(result).toBe(-5);
  });

  describe('[Edges]', () => {
    it('should handle null input by throwing an error', () => {
      expect(() => calculator.add(null, 5)).toThrow();
    });

    it('should handle undefined input by throwing an error', () => {
      expect(() => calculator.add(undefined, 5)).toThrow();
    });
  });
});
```

### Test Quality

- Tests should fail when the expected behavior breaks
- Test reports should clearly indicate which functionality is affected
- Multiple related assertions can be grouped in the same test if they verify the same behavior
- Always separate edge cases from main functionality tests
