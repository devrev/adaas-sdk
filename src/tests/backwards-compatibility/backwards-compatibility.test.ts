import {
  ApiClass,
  ApiConstructor,
  ApiEnum,
  ApiEnumMember,
  ApiFunction,
  ApiInterface,
  ApiItem,
  ApiMethodSignature,
  ApiProperty,
  ApiPropertySignature,
  ApiTypeAlias,
  Parameter,
} from '@microsoft/api-extractor-model';

import {
  getClasses,
  getConstructor,
  getEnums,
  getFunctions,
  getInterfaces,
  getMethodSignatures,
  getProperties,
  getPropertySignatures,
  getTypes,
  loadApiData,
  updateCurrentApiJson,
} from './helpers';

function parseDestructuredParameter(paramName: string): string[] {
  // Extract properties from "{ prop1, prop2, prop3 }" format
  const match = paramName.match(/^\{\s*([^}]+)\s*\}$/);
  if (!match) return [paramName]; // Not destructured, return as-is

  return match[1]
    .split(',')
    .map((prop) => prop.trim())
    .filter((prop) => prop.length > 0);
}

export function checkFunctionCompatibility(
  newFunction: ApiFunction | ApiConstructor | ApiMethodSignature,
  currentFunction: ApiFunction | ApiConstructor | ApiMethodSignature
) {
  const lengthOfPreviousParameters = currentFunction.parameters.length;

  it(`Function ${newFunction.displayName} should have at least as many parameters as the current function`, () => {
    expect(newFunction.parameters.length).toBeGreaterThanOrEqual(
      currentFunction.parameters.length
    );
  });

  it(`Function ${newFunction.displayName} should have parameters in the same order as the current function`, () => {
    const newFunctionParamNames = newFunction.parameters
      .slice(0, lengthOfPreviousParameters)
      .map((p: Parameter) => p.name);
    const currentFunctionParamNames = currentFunction.parameters.map(
      (p: Parameter) => p.name
    );

    // Handle destructured parameters specially
    if (
      newFunctionParamNames.length === 1 &&
      currentFunctionParamNames.length === 1
    ) {
      const newProps = parseDestructuredParameter(newFunctionParamNames[0]);
      const currentProps = parseDestructuredParameter(
        currentFunctionParamNames[0]
      );

      if (newProps.length > 1 || currentProps.length > 1) {
        // Check that all current properties exist in new parameter in same order
        const newPropsStart = newProps.slice(0, currentProps.length);
        expect(newPropsStart).toEqual(currentProps);
        return;
      }
    }

    expect(newFunctionParamNames).toEqual(currentFunctionParamNames);
  });

  it(`Function ${newFunction.displayName} should have compatible parameter types with the current function`, () => {
    const newFunctionParamTypes = newFunction.parameters
      .slice(0, lengthOfPreviousParameters)
      .map((p: Parameter) => p.parameterTypeExcerpt.text);
    const currentFunctionParameterTypes = currentFunction.parameters.map(
      (p: Parameter) => p.parameterTypeExcerpt.text
    );
    expect(newFunctionParamTypes).toEqual(currentFunctionParameterTypes);
  });

  // Check return type compatibility
  // This check fails if it's a constructor, as those don't have a return type
  if (
    currentFunction instanceof ApiFunction &&
    newFunction instanceof ApiFunction
  ) {
    if (!currentFunction.returnTypeExcerpt?.isEmpty) {
      if (
        newFunction.returnTypeExcerpt.text !=
        currentFunction.returnTypeExcerpt.text
      ) {
        // This will pass, if the new implementation is an object and the current one is not specified or a hard-coded type.
        if (
          !(
            currentFunction.returnTypeExcerpt.text.split(' ').length != 1 &&
            newFunction.returnTypeExcerpt.text.split(' ').length == 1
          )
        ) {
          it(`Function ${newFunction.displayName} should have the same return type as the current function`, () => {
            expect(newFunction.returnTypeExcerpt.text).toEqual(
              currentFunction.returnTypeExcerpt.text
            );
          });
        }
      }
    }
  }

  it(`Function ${newFunction.displayName} should have all new parameters as optional`, () => {
    const newParameters = newFunction.parameters.slice(
      lengthOfPreviousParameters
    );
    expect(newParameters.every((p: Parameter) => p.isOptional)).toBe(true);
  });

  it(`Function ${newFunction.displayName} should not have any optional parameters that became required`, () => {
    const minLength = Math.min(
      newFunction.parameters.length,
      currentFunction.parameters.length
    );
    for (let i = 0; i < minLength; i++) {
      const newParam = newFunction.parameters[i];
      const currentParam = currentFunction.parameters[i];

      // If current parameter was optional, new parameter should also be optional
      if (currentParam.isOptional && !newParam.isOptional) {
        throw new Error(
          `Parameter ${newParam.name} became required but was optional`
        );
      }
    }
  });
}

describe('Backwards Compatibility', () => {
  let failure = false;

  afterEach(() => {
    // Check if current test failed
    if (
      expect.getState().currentTestName &&
      expect.getState().suppressedErrors?.length > 0
    ) {
      failure = true;
    }
  });

  describe('Exports', () => {
    describe('should verify that all exports in current are still in new', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newExports = newApiMembers.map((m) => m.displayName);
      const currentExports = currentApiMembers.map(
        (m: ApiItem) => m.displayName
      );

      it.each(currentExports)('should contain export: %s', (exportName) => {
        expect(newExports).toContain(exportName);
      });
    });
  });

  describe('Functions', () => {
    describe('should have all current functions exported in new', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newFunctions: ApiFunction[] = getFunctions(newApiMembers);
      const currentFunctions: ApiFunction[] = getFunctions(currentApiMembers);
      const newFunctionNames = newFunctions.map((f) => f.name);
      for (const currentFunction of currentFunctions) {
        it(`should contain function: ${currentFunction.name}`, () => {
          expect(newFunctionNames).toContain(currentFunction.name);
        });
      }
    });

    describe('should verify function compatibility for each function', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newFunctions: ApiFunction[] = getFunctions(newApiMembers);
      const currentFunctions: ApiFunction[] = getFunctions(currentApiMembers);

      for (const newFunction of newFunctions) {
        const currentFunction = currentFunctions.find(
          (f: ApiFunction) => f.name === newFunction.name
        );

        // Skip if function doesn't exist in current API
        if (!currentFunction) {
          continue;
        }

        checkFunctionCompatibility(newFunction, currentFunction);
      }

      // TODO: Check that optional promotion works only one way (no required parameters becoming optional, but optional parameters can become required)
      // TODO: Check that function overloads weren't removed
      // TODO: Verify that function parameter destructuring patterns maintain compatibility
      // TODO: Check that function parameter default values don't change in breaking ways
    });
  });

  describe('Classes', () => {
    describe('should verify class property counts and compatibility', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newClasses: ApiClass[] = getClasses(newApiMembers);
      const currentClasses: ApiClass[] = getClasses(currentApiMembers);

      for (const newClass of newClasses) {
        const currentClass = currentClasses.find(
          (c: ApiClass) => c.name === newClass.name
        );

        // Skip if class doesn't exist in current API
        if (!currentClass) {
          continue;
        }

        const newClassProperties: ApiProperty[] = getProperties(
          newClass.members
        );
        const currentClassProperties: ApiProperty[] = getProperties(
          currentClass.members
        );

        describe(`Class ${newClass.name} should have at least all public properties from the current class`, () => {
          const newPropertyNames = newClassProperties.map((p) => p.name);
          for (const currentProperty of currentClassProperties) {
            it(`should contain property: ${currentProperty.name}`, () => {
              expect(newPropertyNames).toContain(currentProperty.name);
            });
          }
        });

        describe(`Class ${newClass.name} should not have any optional properties that became required`, () => {
          for (const currentProperty of currentClassProperties) {
            it(`should not have optional property that became required: ${currentProperty.name}`, () => {
              const newProperty = newClassProperties.find(
                (p) => p.name === currentProperty.name
              );
              if (newProperty && currentProperty.isOptional) {
                // If the current property was optional, the new property should also be optional
                expect(newProperty.isOptional).toBe(true);
              }
            });
          }
        });

        // Check property compatibility
        const oldProperties = currentClassProperties;
        const newProperties = newClassProperties;
        for (const newProperty of newProperties) {
          const currentProperty = oldProperties.find(
            (p: ApiProperty) => p.name === newProperty.name
          );
          // If the property is new, there's no need to check for compatibility
          if (!currentProperty) {
            continue;
          }

          it(`Class ${newClass.name} property ${newProperty.name} should have the same type as the current property`, () => {
            expect(newProperty.propertyTypeExcerpt.text).toEqual(
              currentProperty.propertyTypeExcerpt.text
            );
          });

          it(`Class ${newClass.name} property ${newProperty.name} should have the same optionality as the current property`, () => {
            expect(newProperty.isOptional).toEqual(currentProperty.isOptional);
          });
        }

        // Check constructor signature compatibility (same rules as functions)
        const currentMethod = getConstructor(currentClass.members);
        const newMethod = getConstructor(newClass.members);
        checkFunctionCompatibility(newMethod, currentMethod);

        // Check method count
        const newClassMethods = getFunctions(newClass.members);
        const currentClassMethods = getFunctions(currentClass.members);

        describe(`Class ${newClass.name} should export all public methods from the current class`, () => {
          const newMethodNames = newClassMethods.map((m) => m.name);
          for (const currentMethod of currentClassMethods) {
            it(`should contain method: ${currentMethod.name}`, () => {
              expect(newMethodNames).toContain(currentMethod.name);
            });
          }
        });

        // Check method compatibility (same rules as functions)
        // Make sure to allow optional parameters to be added to the end
        for (const newMethod of newClassMethods) {
          const currentMethod = currentClassMethods.find(
            (m: ApiFunction) => m.name === newMethod.name
          );
          // If the method is new, there's no need to check for compatibility
          if (!currentMethod) {
            continue;
          }
          checkFunctionCompatibility(newMethod, currentMethod);
        }

        // TODO: Verify class inheritance hierarchy hasn't changed in breaking ways
        // TODO: Check that class mixins maintain their composition behavior
        // TODO: Verify that abstract class methods remain abstract or are properly implemented
      }
    });
  });

  describe('Interfaces', () => {
    const { newApiMembers, currentApiMembers } = loadApiData();
    const newInterfaces = getInterfaces(newApiMembers);
    const currentInterfaces = getInterfaces(currentApiMembers);

    describe('should verify interface property counts and compatibility', () => {
      for (const newInterface of newInterfaces) {
        const currentInterface = currentInterfaces.find(
          (i: ApiInterface) => i.name === newInterface.name
        );
        if (!currentInterface) {
          continue;
        }

        const newInterfaceProperties = getPropertySignatures(
          newInterface.members
        );
        const currentInterfaceProperties = getPropertySignatures(
          currentInterface.members
        );

        it(`Interface ${newInterface.name} should have at least as many properties as the current interface`, () => {
          expect(newInterfaceProperties.length).toBeGreaterThanOrEqual(
            currentInterfaceProperties.length
          );
        });

        it(`Interface ${newInterface.name} should not have any optional properties that became required`, () => {
          const requiredProperties = newInterfaceProperties.filter(
            (p: ApiPropertySignature) => !p.isOptional
          );
          expect(requiredProperties.length).toBeLessThanOrEqual(
            currentInterfaceProperties.filter(
              (p: ApiPropertySignature) => !p.isOptional
            ).length
          );
        });

        // Check property compatibility
        const oldProperties = currentInterfaceProperties;
        const newProperties = newInterfaceProperties;
        for (const newProperty of newProperties) {
          const currentProperty = oldProperties.find(
            (p: ApiPropertySignature) => p.name === newProperty.name
          );
          // If the property is new, there's no need to check for compatibility
          if (!currentProperty) {
            continue;
          }

          it(`Interface ${newInterface.name} property ${newProperty.name} should have the same type as the current property`, () => {
            expect(newProperty.propertyTypeExcerpt.text).toEqual(
              currentProperty.propertyTypeExcerpt.text
            );
          });

          it(`Interface ${newInterface.name} property ${newProperty.name} should have not been made required if it was optional`, () => {
            // If the new property is required, it must have been required before.
            // Otherwise we break backwards-compatibility.
            expect(
              // If it was required before, it can be either now.
              !currentProperty.isOptional ||
                // If it was optional before, it can only be optional now.
                newProperty.isOptional
            ).toEqual(true);
          });
        }

        // Check method count
        const newInterfaceMethods = getMethodSignatures(newInterface.members);
        const currentInterfaceMethods = getMethodSignatures(
          currentInterface.members
        );

        it(`Interface ${newInterface.name} should have at least as many public methods as the current interface`, () => {
          expect(newInterfaceMethods.length).toBeGreaterThanOrEqual(
            currentInterfaceMethods.length
          );
        });

        // Check method compatibility (same rules as functions)
        // Make sure to allow optional parameters to be added to the end
        for (const newMethod of newInterfaceMethods) {
          const currentMethod = currentInterfaceMethods.find(
            (m: ApiMethodSignature) => m.name === newMethod.name
          );
          // If the method is new, there's no need to check for compatibility
          if (!currentMethod) {
            continue;
          }
          checkFunctionCompatibility(newMethod, currentMethod);
        }
      }
    });

    // TODO: Verify interface inheritance hierarchy hasn't changed
    // TODO: Check that interface merging behavior is preserved
    // TODO: Verify that interface index signatures maintain their key/value types
  });

  describe('Enums', () => {
    let newEnums: ApiEnum[];
    let currentEnums: ApiEnum[];

    describe('should verify enum value counts and existence', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      newEnums = getEnums(newApiMembers);
      currentEnums = getEnums(currentApiMembers);

      // Verify no enum values were removed
      for (const newEnum of newEnums) {
        const currentEnum = currentEnums.find(
          (e: ApiEnum) => e.name === newEnum.name
        );

        // If it's a new enum, there's no need to check for compatibility
        if (!currentEnum) {
          continue;
        }

        const currentEnumValues = currentEnum.members;
        const newEnumValues = newEnum.members;

        it(`Enum ${newEnum.name} should have at least as many enum values as the current enum`, () => {
          expect(newEnumValues.length).toBeGreaterThanOrEqual(
            currentEnumValues.length
          );
        });

        for (const currentEnumValue of currentEnumValues) {
          const newEnumValue = newEnumValues.find(
            (v: ApiEnumMember) => v.name === currentEnumValue.name
          );

          // If it's a new enum value, there's no need to check for compatibility
          if (!newEnumValue) {
            continue;
          }

          it(`Enum ${newEnum.name} should contain enum value: ${currentEnumValue.name}`, () => {
            expect(newEnumValue).toBeDefined();
          });
        }
      }
    });

    // Verify numeric enum values haven't changed (if numeric enum)
    describe('should verify numeric enum values have not changed', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      newEnums = getEnums(newApiMembers);
      currentEnums = getEnums(currentApiMembers);

      for (const newEnum of newEnums) {
        const currentEnum = currentEnums.find(
          (e: ApiEnum) => e.name === newEnum.name
        );

        // If it's a new enum, there's no need to check for compatibility
        if (!currentEnum) {
          continue;
        }

        // Helper function to determine if an enum is numeric based on its members' initializer values
        const isNumericEnum = (enumMembers: ApiEnumMember[]): boolean => {
          return enumMembers.every((member: ApiEnumMember) => {
            // Check if the member has an initializer and if it's a numeric value
            const initializerText = member.excerptTokens
              ?.find(
                (token) =>
                  token.kind === 'Content' && /^\d+$/.test(token.text.trim())
              )
              ?.text?.trim();
            return (
              initializerText !== undefined && /^\d+$/.test(initializerText)
            );
          });
        };

        const newEnumNumeric = isNumericEnum([...newEnum.members]);
        const currentEnumNumeric = isNumericEnum([...currentEnum.members]);

        it(`Enum ${newEnum.name} should have the same numeric type as the current enum`, () => {
          expect(newEnumNumeric).toBe(currentEnumNumeric);
        });

        const currentEnumValues = currentEnum.members;
        const newEnumValues = newEnum.members;

        it(`Enum ${newEnum.name} should have at least as many enum values as the current enum`, () => {
          expect(newEnumValues.length).toBeGreaterThanOrEqual(
            currentEnumValues.length
          );
        });

        for (const currentEnumValue of currentEnumValues) {
          const newEnumValue = newEnumValues.find(
            (v: ApiEnumMember) => v.name === currentEnumValue.name
          );

          // If it's not defined, an existing value is missing from the new enum
          it(`Enum ${newEnum.name} should contain enum value: ${currentEnumValue.name}`, () => {
            expect(newEnumValue).toBeDefined();
          });

          it(`Enum ${newEnum.name} should have the same value for enum member: ${currentEnumValue.name}`, () => {
            // Both can be undefined, but they should always equal each other
            const newValue = newEnumValue!.initializerExcerpt?.text;
            const currentValue = currentEnumValue.initializerExcerpt?.text;
            expect(newValue).toEqual(currentValue);
          });
        }
      }
    });
    // TODO: Check that new enum values were only added at the end (best practice)
    // TODO: Verify that const enums maintain their compile-time behavior
    // TODO: Check that enum member values don't change in breaking ways
    describe('should verify enum value types have been added to the end', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      newEnums = getEnums(newApiMembers);
      currentEnums = getEnums(currentApiMembers);

      for (const newEnum of newEnums) {
        const currentEnum = currentEnums.find(
          (e: ApiEnum) => e.name === newEnum.name
        );

        // If it's a new enum, there's no need to check for compatibility
        if (!currentEnum) {
          continue;
        }

        const currentEnumValues = currentEnum.members.map(
          (a: ApiEnumMember) => a.name
        );
        const newEnumValues = newEnum.members
          .slice(0, currentEnumValues.length)
          .map((a: ApiEnumMember) => a.name);

        // This might appear to not be working sometimes, but remember that the order of enum values is determined by the enum member key name
        it(`Enum ${newEnum.name} should have added new options to the end of the array`, () => {
          expect(newEnumValues).toStrictEqual(currentEnumValues);
        });
      }
    });
  });

  describe('Types', () => {
    const { newApiMembers, currentApiMembers } = loadApiData();
    const newTypes = getTypes(newApiMembers);
    const currentTypes = getTypes(currentApiMembers);

    // Verify type aliases weren't removed
    describe("should verify type aliases weren't removed", () => {
      for (const newType of newTypes) {
        const currentType = currentTypes.find(
          (t: ApiTypeAlias) => t.name === newType.name
        );
        if (!currentType) {
          continue;
        }
        it(`Type ${newType.name} should not have been removed`, () => {
          expect(currentType).toBeDefined();
        });
      }
    });

    // Verify that the type alias is the same as the current type alias
    describe('should verify type aliases are the same as the current type aliases', () => {
      for (const newType of newTypes) {
        const currentType = currentTypes.find(
          (t: ApiTypeAlias) => t.name === newType.name
        );
        if (!currentType) {
          continue;
        }
        it(`Type ${newType.name} should have the same type as the current type`, () => {
          // Replace all whitespace with an empty string to ignore whitespace differences
          expect(newType.typeExcerpt.text.replace(/\s/g, '')).toEqual(
            currentType.typeExcerpt.text.replace(/\s/g, '')
          );
        });
      }
    });

    // TODO: Verify union types didn't become more restrictive (no types removed from union)
    // TODO: Verify intersection types didn't become more permissive (no required types removed)
    // TODO: Check generic type parameter compatibility
  });

  describe('Method Signatures', () => {
    // TODO: Verify generic constraints haven't become more restrictive
    // TODO: Check that default parameter values are still compatible
    // TODO: Verify rest parameters (...args) compatibility
    // TODO: Check function signature overloads
  });

  describe('Generics', () => {
    // TODO: Verify generic type parameters weren't removed
    // TODO: Check that generic constraints didn't become more restrictive
    // TODO: Verify generic parameter names haven't changed (affects explicit type arguments)
    // TODO: Check variance compatibility (covariant/contravariant)
  });

  describe('Property Types', () => {
    // TODO: Check readonly properties didn't become mutable (or vice versa in breaking way)
    // TODO: Verify array types compatibility (T[] vs Array<T>)
    // TODO: Check Promise/async compatibility
    // TODO: Verify callback function signature compatibility
  });

  describe('Accessibility', () => {
    // TODO: Verify public members didn't become private/protected
    // TODO: Check that protected members didn't become private
    // TODO: Ensure no breaking changes in static vs instance members
  });

  afterAll(() => {
    // If there are any failures, don't update the current API baseline files
    if (failure) {
      return;
    }
    updateCurrentApiJson();
  });
});
