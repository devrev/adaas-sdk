# Contributing

All changes must be made through Pull Requests. Direct commits to `main` or `stable` branches are not allowed.

## Branching Strategy

- **`main`** is the development branch. All feature PRs target `main`.
- **`stable`** is the release branch. All stable npm releases are made exclusively from `stable`.
- **`v2`** is the development branch for the next major version (`@devrev/airsync-sdk`).

## Versioning

We follow Semantic Versioning (SemVer) for versioning, with the format `MAJOR.MINOR.PATCH`.

- `MAJOR` - Breaking changes, incompatible API changes
- `MINOR` - New features, backwards compatible
- `PATCH` - Bug fixes, no new features

## Releasing

### Stable Release

1. Open a PR from `main` to `stable`.
2. In that PR, update the version in `package.json` and `package-lock.json` to the desired release version.
3. Once the PR is approved and merged, the release workflow runs automatically. It compares the version in `package.json` against the latest version on npm and, if changed, publishes the new version with the `latest` tag.
4. The workflow creates a git tag and generates GitHub release notes.
5. The workflow opens a PR to merge `stable` back into `main`. Review and merge this PR to keep the branches in sync.

### Hotfix

1. Branch off `stable` (e.g., `hotfix/fix-description`).
2. Fix the bug and bump the patch version in `package.json` and `package-lock.json`.
3. Open a PR into `stable`.
4. Once merged, the release workflow runs automatically and publishes the hotfix.
5. Review and merge the auto-created PR from `stable` back into `main`.

### Beta Release

1. Trigger the "Release beta" workflow manually from the GitHub Actions UI.
2. Beta releases can be made from any branch **except** `stable`.
3. When run from `v2`, the workflow publishes to `@devrev/airsync-sdk`. From all other branches, it publishes to `@devrev/ts-adaas`.
4. The beta version is automatically bumped (prerelease increment) and published with the `beta` tag on npm.

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
