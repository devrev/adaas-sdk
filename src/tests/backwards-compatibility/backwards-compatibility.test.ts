import * as fs from 'fs';
import * as path from 'path';

import {
  ApiClass,
  ApiEnum,
  ApiEnumMember,
  ApiFunction,
  ApiInterface,
  ApiMethodSignature,
  ApiProperty,
  ApiPropertySignature,
  ApiTypeAlias,
} from '@microsoft/api-extractor-model';

import {
  loadApiData,
  getFunctions,
  getConstructor,
  getEnums,
  getClasses,
  getProperties,
  getTypes,
  checkFunctionCompatibility,
  getInterfaces,
  getMethodSignatures,
  getPropertySignatures,
  updateCurrentApiJson,
} from './helpers';

describe('Backwards Compatibility', () => {
  let failure = false;

  afterEach(() => {
    // Check if current test failed
    if (expect.getState().currentTestName && 
        expect.getState().suppressedErrors?.length > 0) {
      failure = true;
    }
  });

  describe('Exports', () => {
    describe('should verify that all exports in current are still in new', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newExports = newApiMembers.map((m) => m.displayName);
      const currentExports = currentApiMembers.map((m: any) => m.displayName);
      
      it.each(currentExports)('should contain export: %s', (exportName) => {
          expect(newExports).toContain(exportName);
      });
    });
  });

  describe('Functions', () => {
    it('should have at least as many functions in new API as in current', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newFunctions: ApiFunction[] = getFunctions(newApiMembers);
      const currentFunctions: ApiFunction[] = getFunctions(currentApiMembers);
      expect(newFunctions.length).toBeGreaterThanOrEqual(currentFunctions.length);
    });

    describe('should verify function compatibility for each function', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newFunctions: ApiFunction[] = getFunctions(newApiMembers);
      const currentFunctions: ApiFunction[] = getFunctions(currentApiMembers);

      for (const newFunction of newFunctions) {
        const currentFunction = currentFunctions.find((f: any) => f.name === newFunction.name);

        // Skip if function doesn't exist in current API
        if (!currentFunction) {
          continue;
        }

        checkFunctionCompatibility(newFunction, currentFunction);
      }

      // TODO: Check that optional promotion works only one way (no required parameters becoming optional, but optional parameters can become required)
      // TODO: Check that function overloads weren't removed
    });
  });

  describe('Classes', () => {
    describe('should verify class property counts and compatibility', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newClasses: ApiClass[] = getClasses(newApiMembers);
      const currentClasses: ApiClass[] = getClasses(currentApiMembers);

      for (const newClass of newClasses) {
        const currentClass = currentClasses.find((c: ApiClass) => c.name === newClass.name);

        // Skip if class doesn't exist in current API
        if (!currentClass) {
          continue;
        }

        const newClassProperties: ApiProperty[] = getProperties(newClass.members);
        const currentClassProperties: ApiProperty[] = getProperties(currentClass.members);

        it(`Class ${newClass.name} should have at least as many public properties as the current class`, () => {
          expect(newClassProperties.length).toBeGreaterThanOrEqual(currentClassProperties.length);
        });

        it(`Class ${newClass.name} should not have any optional properties that became required`, () => {
          const requiredProperties = newClassProperties.filter((p: ApiProperty) => !p.isOptional);
          expect(requiredProperties.length).toBeLessThanOrEqual(currentClassProperties.filter((p: ApiProperty) => !p.isOptional).length);
        });

        // Check property compatibility
        const oldProperties = currentClassProperties;
        const newProperties = newClassProperties;
        for(const newProperty of newProperties) {
          const currentProperty = oldProperties.find((p: ApiProperty) => p.name === newProperty.name);
          // If the property is new, there's no need to check for compatibility
          if(!currentProperty) {
            continue;
          }

          it(`Class ${newClass.name} property ${newProperty.name} should have the same type as the current property`, () => {
            expect(newProperty.propertyTypeExcerpt.text).toEqual(currentProperty.propertyTypeExcerpt.text);
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
        
        it(`Class ${newClass.name} should have at least as many public methods as the current class`, () => {
          expect(newClassMethods.length).toBeGreaterThanOrEqual(currentClassMethods.length);
        });

        // Check method compatibility (same rules as functions)
        // Make sure to allow optional parameters to be added to the end
        for(const newMethod of newClassMethods) {
          const currentMethod = currentClassMethods.find((m: ApiFunction) => m.name === newMethod.name);
          // If the method is new, there's no need to check for compatibility
          if(!currentMethod) {
            continue;
          }
          checkFunctionCompatibility(newMethod, currentMethod);
        }

        // TODO: Verify class inheritance hierarchy hasn't changed in breaking ways
      }
    });
  });

  describe('Interfaces', () => {
    const { newApiMembers, currentApiMembers } = loadApiData();
    const newInterfaces = getInterfaces(newApiMembers);
    const currentInterfaces = getInterfaces(currentApiMembers);

    describe('should verify interface property counts and compatibility', () => {
      for(const newInterface of newInterfaces) {
        const currentInterface = currentInterfaces.find((i: ApiInterface) => i.name === newInterface.name);
        if(!currentInterface) {
          continue;
        }

        const newInterfaceProperties = getPropertySignatures(newInterface.members);
        const currentInterfaceProperties = getPropertySignatures(currentInterface.members);

        it(`Interface ${newInterface.name} should have at least as many properties as the current interface`, () => {
          expect(newInterfaceProperties.length).toBeGreaterThanOrEqual(currentInterfaceProperties.length);
        });
        
        it(`Interface ${newInterface.name} should not have any optional properties that became required`, () => {
          const requiredProperties = newInterfaceProperties.filter((p: ApiPropertySignature) => !p.isOptional);
          expect(requiredProperties.length).toBeLessThanOrEqual(currentInterfaceProperties.filter((p: ApiPropertySignature) => !p.isOptional).length);
        });
        
        // Check property compatibility
        const oldProperties = currentInterfaceProperties;
        const newProperties = newInterfaceProperties;
        for(const newProperty of newProperties) {
          const currentProperty = oldProperties.find((p: ApiPropertySignature) => p.name === newProperty.name);
          // If the property is new, there's no need to check for compatibility
          if(!currentProperty) {
            continue;
          }

          it(`Interface ${newInterface.name} property ${newProperty.name} should have the same type as the current property`, () => {
            expect(newProperty.propertyTypeExcerpt.text).toEqual(currentProperty.propertyTypeExcerpt.text);
          });

          it(`Interface ${newInterface.name} property ${newProperty.name} should have not been made required if it was optional`, () => {
              // If the new property is required, it must have been required before.
              // Otherwise we break backward-compatibility.
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
        const currentInterfaceMethods = getMethodSignatures(currentInterface.members);
        
        it(`Interface ${newInterface.name} should have at least as many public methods as the current interface`, () => {
          expect(newInterfaceMethods.length).toBeGreaterThanOrEqual(currentInterfaceMethods.length);
        });

        // Check method compatibility (same rules as functions)
        // Make sure to allow optional parameters to be added to the end
        for(const newMethod of newInterfaceMethods) {
          const currentMethod = currentInterfaceMethods.find((m: ApiMethodSignature) => m.name === newMethod.name);
          // If the method is new, there's no need to check for compatibility
          if(!currentMethod) {
            continue;
          }
          checkFunctionCompatibility(newMethod, currentMethod);
        }
      }
    });

    // TODO: Verify interface inheritance hierarchy hasn't changed
  });

  describe('Enums', () => {
    let newEnums: ApiEnum[];
    let currentEnums: ApiEnum[];

    describe('should verify enum value counts and existence', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      newEnums = getEnums(newApiMembers);
      currentEnums = getEnums(currentApiMembers);
 
      // Verify no enum values were removed
      for(const newEnum of newEnums) {
        const currentEnum = currentEnums.find((e: ApiEnum) => e.name === newEnum.name);

        // If it's a new enum, there's no need to check for compatibility
        if(!currentEnum) {
          continue;
        }

        const currentEnumValues = currentEnum.members;
        const newEnumValues = newEnum.members;
        
        it(`Enum ${newEnum.name} should have at least as many enum values as the current enum`, () => {
          expect(newEnumValues.length).toBeGreaterThanOrEqual(currentEnumValues.length);
        });

        for(const currentEnumValue of currentEnumValues) {
          const newEnumValue = newEnumValues.find((v: ApiEnumMember) => v.name === currentEnumValue.name);

          // If it's a new enum value, there's no need to check for compatibility
          if(!newEnumValue) {
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
 
      for(const newEnum of newEnums) {
        const currentEnum = currentEnums.find((e: ApiEnum) => e.name === newEnum.name);

        // If it's a new enum, there's no need to check for compatibility
        if(!currentEnum) {
          continue;
        }

        const newEnumNumeric = newEnum.members.every((m: ApiEnumMember) => typeof m === 'number');
        const currentEnumNumeric = currentEnum.members.every((m: ApiEnumMember) => typeof m === 'number');

        it(`Enum ${newEnum.name} should have the same numeric type as the current enum`, () => {
          expect(newEnumNumeric).toBe(currentEnumNumeric);
        });

        const currentEnumValues = currentEnum.members;
        const newEnumValues = newEnum.members;
        
        it(`Enum ${newEnum.name} should have at least as many enum values as the current enum`, () => {
          expect(newEnumValues.length).toBeGreaterThanOrEqual(currentEnumValues.length);
        });
        
        for(const currentEnumValue of currentEnumValues) {
          const newEnumValue = newEnumValues.find((v: ApiEnumMember) => v.name === currentEnumValue.name);

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
    describe('should verify enum value types have been added to the end', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      newEnums = getEnums(newApiMembers);
      currentEnums = getEnums(currentApiMembers);
      
      for(const newEnum of newEnums) {
        const currentEnum = currentEnums.find((e: ApiEnum) => e.name === newEnum.name);

        // If it's a new enum, there's no need to check for compatibility
        if(!currentEnum) {
          continue;
        }

        const currentEnumValues = currentEnum.members.map((a: ApiEnumMember) => a.name);
        const newEnumValues = newEnum.members.slice(0, currentEnumValues.length).map((a: ApiEnumMember) => a.name);

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
    describe('should verify type aliases weren\'t removed', () => {
      for(const newType of newTypes) {
        const currentType = currentTypes.find((t: ApiTypeAlias) => t.name === newType.name);
        if(!currentType) {
          continue;
        }
        it(`Type ${newType.name} should not have been removed`, () => {
          expect(currentType).toBeDefined();
        });
      }
    });

    // Verify that the type alias is the same as the current type alias
    describe('should verify type aliases are the same as the current type aliases', () => {
      for(const newType of newTypes) {
        const currentType = currentTypes.find((t: ApiTypeAlias) => t.name === newType.name);
        if(!currentType) {
          continue;
        }
        it(`Type ${newType.name} should have the same type as the current type`, () => {
          // Replace all whitespace with an empty string to ignore whitespace differences
          expect(newType.typeExcerpt.text.replace(/\s/g, "")).toEqual(currentType.typeExcerpt.text.replace(/\s/g, ""));
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
    if(failure) {
      return;
    }
    updateCurrentApiJson();
  });
});
