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
describe(MyClass.name, () => {
  it('should perform expected behavior when given valid input', () => {
    // Test implementation
  });

  it('should handle specific scenario correctly', () => {
    // Test implementation
  });

  it('[edge] should handle null input appropriately', () => {
    // Edge case test
  });

  it('[edge] should handle undefined input appropriately', () => {
    // Edge case test
  });
});
```

### Test Naming Conventions

- **Describe blocks**: Name after the symbol being tested (class, function, etc.). Use the symbol's `.name` property when available instead of hardcoding the name (e.g., `MyClass.name` instead of `'MyClass'`)
- **It blocks**: Write descriptive test names that start with "should" and describe the expected behavior
- **Edge cases**: Prefix edge case tests with `[edge]` tag (e.g., `it('[edge] should handle null input...')`)

### Test Guidelines

1. **Single Responsibility**: Each test should verify only one specific behavior or outcome
2. **Descriptive Names**: Test names should clearly describe what functionality is being tested
3. **Behavior Testing**: Tests should verify behavior, not implementation details
4. **Edge Cases**: Handle `null`, `undefined`, and other edge cases using the `[edge]` tag prefix
5. **Simplicity**: Keep tests simple and easy to understand
6. **Clarity over Brevity**: Prioritize easily understandable tests over small tests. Tests typically represent 60-70% of a software project's source code, so clarity is essential
7. **Avoid Unnecessary Abstractions**: Minimize abstractions in tests unless absolutely necessary, as they add complexity and make it harder to understand the test steps
8. **AAA Pattern**: Follow the Arrange, Act, Assert pattern for test structure:
   - **Arrange**: Set up test data, dependencies, and initial state
   - **Act**: Execute the function or method being tested
   - **Assert**: Verify the expected outcome or behavior

### Testing Scope and Focus

**Primary Focus: Public Interfaces**
- Tests should primarily focus on testing public-facing (exported) interfaces and APIs
- Test the behavior that external consumers of your code will experience
- This ensures that breaking changes to public contracts are caught by tests

**Internal Logic Testing**
- Be pragmatic about testing internal logic when it provides significant value
- Internal APIs used globally across the application may warrant dedicated test files
- Example: `metrics.spec.ts` tests the public endpoint controller, while `metrics.interceptor.spec.ts` tests internal API used globally
- You can rename or move test files later if they organically outgrow their original scope or no longer fit together

### Example

```typescript
describe(Calculator.name, () => {
  it('should add two positive numbers correctly', () => {
    // Arrange
    const calculator = new Calculator();
    const firstNumber = 2;
    const secondNumber = 3;
    const expectedResult = 5;

    // Act
    const result = calculator.add(firstNumber, secondNumber);

    // Assert
    expect(result).toBe(expectedResult);
  });

  it('should add negative numbers correctly', () => {
    // Arrange
    const calculator = new Calculator();
    const firstNumber = -2;
    const secondNumber = -3;
    const expectedResult = -5;

    // Act
    const result = calculator.add(firstNumber, secondNumber);

    // Assert
    expect(result).toBe(expectedResult);
  });

  it('[edge] should handle null input by throwing an error', () => {
    // Arrange
    const calculator = new Calculator();
    const nullValue = null;
    const validNumber = 5;

    // Act & Assert
    expect(() => calculator.add(nullValue, validNumber)).toThrow();
  });

  it('[edge] should handle undefined input by throwing an error', () => {
    // Arrange
    const calculator = new Calculator();
    const undefinedValue = undefined;
    const validNumber = 5;

    // Act & Assert
    expect(() => calculator.add(undefinedValue, validNumber)).toThrow();
  });
});
```

### Test Quality

- Tests should fail when the expected behavior breaks
- Test reports should clearly indicate which functionality is affected
- Multiple related assertions can be grouped in the same test if they verify the same behavior
- Always mark edge cases with the `[edge]` tag prefix to distinguish them from main functionality tests
