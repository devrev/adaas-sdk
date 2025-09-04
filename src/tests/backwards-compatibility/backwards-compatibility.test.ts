import * as fs from 'fs';
import * as path from 'path';


import {
  ApiClass,
  ApiConstructor,
  ApiEnum,
  ApiEnumMember,
  ApiFunction,
  ApiItem,
  ApiModel,
  ApiProperty,
  Parameter
} from '@microsoft/api-extractor-model';



describe('Validate API report', () => {
  let failure = false;
  const newApiMdPath = path.join(__dirname, 'temp', 'ts-adaas.md');
  const currentApiMdPath = path.join(__dirname, 'ts-adaas.md');
  const newApiJsonPath = path.join(__dirname, 'temp', 'ts-adaas.api.json');
  const currentApiJsonPath = path.join(__dirname, 'ts-adaas.api.json');

  afterEach(() => {
    // Check if current test failed
    if (expect.getState().currentTestName && 
        expect.getState().suppressedErrors?.length > 0) {
      failure = true;
    }
  });

  // Helper function to load API data
  const loadApiData = (): { newApiMembers: readonly ApiItem[], currentApiMembers: readonly ApiItem[] } => {
    if (!fs.existsSync(newApiJsonPath)) {
      throw new Error(
        'API reports not found. Run the generate-api-report test first.'
      );
    }


    const newApiModel = new ApiModel().loadPackage(newApiJsonPath);
    const newApiMembers = newApiModel.entryPoints[0].members;

    const currentApiModel = new ApiModel().loadPackage(currentApiJsonPath);
    const currentApiMembers = currentApiModel.entryPoints[0].members;

    return { newApiMembers, currentApiMembers };
  };

  // Helper functions for getting different kinds of items from the API members
  const getFunctions = (members: readonly ApiItem[]): ApiFunction[] => {
    return members.filter((m: ApiItem) => m instanceof ApiFunction && m.kind === 'Function') as ApiFunction[];
  }
  const getConstructor = (members: readonly ApiItem[]): ApiConstructor => {
    return (members.filter((m: ApiItem) => m instanceof ApiConstructor && m.kind === 'Constructor') as ApiConstructor[])[0];
  }
  const getEnums = (members: readonly ApiItem[]): ApiEnum[] => {
    return members.filter((m: ApiItem) => m instanceof ApiEnum && m.kind === 'Enum') as ApiEnum[];
  }
  const getClasses = (members: readonly ApiItem[]): ApiClass[] => {
    return members.filter((m: ApiItem) => m instanceof ApiClass && m.kind === 'Class') as ApiClass[];
  }
  const getProperties = (members: readonly ApiItem[]): ApiProperty[] => {
    return members.filter((m: ApiItem) => m instanceof ApiProperty && m.kind === 'Property') as ApiProperty[];
  }

  describe('Exports', () => {
    describe('should verify that all exports in current are still in new', () => {
      const { newApiMembers, currentApiMembers } = loadApiData();
      const newExports = newApiMembers.map((m) => m.displayName);
      const currentExports = currentApiMembers.map((m: any) => m.displayName);
      
      for (const exportName of currentExports) {
        it(`should contain export: ${exportName}`, () => {
          expect(newExports).toContain(exportName);
        });
      }
    });
  });

  const checkFunctionCompatibility = (newFunction: ApiFunction | ApiConstructor, currentFunction: ApiFunction | ApiConstructor) => {
    const lengthOfPreviousParameters = currentFunction.parameters.length;

    it(`Function ${newFunction.displayName} should have at least as many parameters as the current function`, () => {
      expect(newFunction.parameters.length).toBeGreaterThanOrEqual(currentFunction.parameters.length);
    });

    it(`Function ${newFunction.displayName} should have parameters in the same order as the current function`, () => {
      const newFunctionParamNames = newFunction.parameters.slice(0, lengthOfPreviousParameters).map((p: Parameter) => p.name);
      const currentFunctionParamNames = currentFunction.parameters.map((p: Parameter) => p.name);
      expect(newFunctionParamNames).toEqual(currentFunctionParamNames);
    });

    it(`Function ${newFunction.displayName} should have compatible parameter types with the current function`, () => {
      const newFunctionParamTypes = newFunction.parameters.slice(0, lengthOfPreviousParameters).map((p: Parameter) => p.parameterTypeExcerpt.text);
      const currentFunctionParameterTypes = currentFunction.parameters.map((p: Parameter) => p.parameterTypeExcerpt.text);
      expect(newFunctionParamTypes).toEqual(currentFunctionParameterTypes);
    });
    
    // Check return type compatibility
    // This check fails if it's a constructor, as those don't have a return type
    if(currentFunction instanceof ApiFunction && newFunction instanceof ApiFunction){
      if(!currentFunction.returnTypeExcerpt?.isEmpty) {
        it(`Function ${newFunction.displayName} should have the same return type as the current function`, () => {
          expect(newFunction.returnTypeExcerpt.text).toEqual(currentFunction.returnTypeExcerpt.text);
        });
      }
    }

    it(`Function ${newFunction.displayName} should have all new parameters as optional`, () => {
      const newParameters = newFunction.parameters.slice(lengthOfPreviousParameters);
      expect(newParameters.every((p: Parameter) => p.isOptional)).toBe(true);
    });

    it(`Function ${newFunction.displayName} should not have any optional parameters that became required`, () => {
      const requiredParameters = newFunction.parameters.filter((p: Parameter) => !p.isOptional);
      const currentRequiredParameters = currentFunction.parameters.filter((p: Parameter) => !p.isOptional);
      expect(requiredParameters.length).toBeLessThanOrEqual(currentRequiredParameters.length);
    });
  }

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
    // TODO: Verify no properties were removed
    // TODO: Verify no optional properties became required
    // TODO: Verify property names haven't changed
    // TODO: Verify property types are compatible
    // TODO: Check that method signatures are compatible (if interface has methods)
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
    // TODO: Verify type aliases weren't removed
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
    if (fs.existsSync(newApiMdPath) && fs.existsSync(newApiJsonPath)) {
      fs.copyFileSync(newApiMdPath, currentApiMdPath);
      fs.copyFileSync(newApiJsonPath, currentApiJsonPath);

      console.log(`Updated current API baseline files.`);
    } else {
      console.warn('No new API reports found.');
    }
  });
});
