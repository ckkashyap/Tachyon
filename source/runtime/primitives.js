/* _________________________________________________________________________
 *
 *             Tachyon : A Self-Hosted JavaScript Virtual Machine
 *
 *
 *  This file is part of the Tachyon JavaScript project. Tachyon is
 *  distributed at:
 *  http://github.com/Tachyon-Team/Tachyon
 *
 *
 *  Copyright (c) 2011, Universite de Montreal
 *  All rights reserved.
 *
 *  This software is licensed under the following license (Modified BSD
 *  License):
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions are
 *  met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the name of the Universite de Montreal nor the names of its
 *      contributors may be used to endorse or promote products derived
 *      from this software without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 *  IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 *  TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 *  PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL UNIVERSITE DE
 *  MONTREAL BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 *  LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * _________________________________________________________________________
 */

/**
@fileOverview
Implementation of high-level IR instructions through handler functions

@author
Maxime Chevalier-Boisvert
*/

//=============================================================================
//
// Primitive functions to operate on boxed values
//
//=============================================================================

/**
Box an integer value
*/
function boxInt(intVal)
{
    "tachyon:inline";
    "tachyon:arg intVal pint";

    // Box the integer
    return iir.icast(IRType.box, intVal << TAG_NUM_BITS_INT);
}

/**
Unbox an integer value
*/
function unboxInt(boxVal)
{
    "tachyon:inline";
    "tachyon:noglobal";
    "tachyon:ret pint";

    // Unbox the integer
    return iir.icast(IRType.pint, boxVal) >> TAG_NUM_BITS_INT;
}

/**
Box a raw pointer value
*/
function boxPtr(rawPtr, tagVal)
{
    "tachyon:inline";
    "tachyon:arg rawPtr rptr";
    "tachyon:arg tagVal pint";

    // Box the raw pointer
    return iir.icast(IRType.box, rawPtr | tagVal);
}

/**
Box a reference value
*/
function boxRef(refVal, tagVal)
{
    "tachyon:inline";
    "tachyon:arg refVal ref";
    "tachyon:arg tagVal pint";

    // Box the raw pointer
    return iir.icast(IRType.box, refVal | tagVal);
}

/**
Unbox a reference value
*/
function unboxRef(boxVal)
{
    "tachyon:inline";
    "tachyon:ret ref";

    // Box the raw pointer
    return iir.icast(IRType.ref, boxVal & ~TAG_REF_MASK);
}

/**
Get the reference tag of a boxed value
*/
function getRefTag(boxVal)
{
    "tachyon:inline";
    "tachyon:ret pint";

    // Mask out the non-tag part
    return boxVal & TAG_REF_MASK;
}

/**
Test if a boxed value has a specific reference tag
*/
function boxHasTag(boxVal, tagVal)
{
    "tachyon:inline";
    "tachyon:arg tagVal pint";

    // Compare the reference tag
    return getRefTag(boxVal) === tagVal;
}

/**
Test if a boxed value is integer
*/
function boxIsInt(boxVal)
{
    "tachyon:inline";

    // Test if the value has the int tag
    return (boxVal & TAG_INT_MASK) === TAG_INT;
}

/**
Test if a boxed value is a reference
*/
function boxIsRef(boxVal)
{
    "tachyon:inline";
    "tachyon:noglobal";

    if (boxIsInt(boxVal) === true)
        return false;

    if (iir.icast(IRType.puint, boxVal) <= iir.icast(IRType.puint, BIT_PATTERN_NOT_FOUND))
        return false;

    return true;
}

/**
Test if a boxed value is an object
*/
function boxIsObj(boxVal)
{
    "tachyon:inline";

    // Compare the reference tag
    return getRefTag(boxVal) === TAG_OBJECT;
}

/**
Test if a boxed value is a function
*/
function boxIsFunc(boxVal)
{
    "tachyon:inline";

    // Compare the reference tag
    return getRefTag(boxVal) === TAG_FUNCTION;
}

/**
Test if a boxed value is an array
*/
function boxIsArray(boxVal)
{
    "tachyon:inline";

    // Compare the reference tag
    return getRefTag(boxVal) === TAG_ARRAY;
}

/**
Test if a boxed value is an object or an object extension (array or function)
*/
function boxIsExtObj(boxVal)
{
    "tachyon:inline";

    // Test that the tag is either array, function or object
    var tag = getRefTag(boxVal);
    return (tag >= TAG_ARRAY && tag <= TAG_OBJECT);
}

/**
Test if a boxed value is a floating-point value
*/
function boxIsFloat(boxVal)
{
    "tachyon:inline";

    // Compare the reference tag
    return getRefTag(boxVal) === TAG_FLOAT;
}

/**
Test if a boxed value is a string
*/
function boxIsString(boxVal)
{
    "tachyon:inline";

    // Compare the reference tag
    return getRefTag(boxVal) === TAG_STRING;
}

/**
Convert a boxed value to a boolean value
*/
function boxToBool(boxVal)
{
    "tachyon:static";
    "tachyon:noglobal";

    // Get an integer-typed value for input
    var boxInt = iir.icast(IRType.pint, boxVal);

    if (boxInt === BIT_PATTERN_TRUE)
        return true;

    else if (boxInt === BIT_PATTERN_FALSE)
        return false;

    else if (boxInt === BIT_PATTERN_UNDEF)
        return false;

    else if (boxInt === BIT_PATTERN_NULL)
        return false;

    else if (boxIsInt(boxVal))
    { 
        if (boxInt !== pint(0))
            return true;
        else
            return false;
    }

    else if (boxIsString(boxVal))
    {
        var len = iir.icast(IRType.pint, get_str_size(boxVal));

        if (len !== pint(0))
            return true;
        else
            return false;
    }

    return true;
}

/**
Convert a boxed value to a primitive value.
*/
function boxToPrim(boxVal)
{
    "tachyon:static";
    "tachyon:noglobal";

    if (boxIsExtObj(boxVal))
        return boxToString(boxVal);

    return boxVal;
}

/**
Attempt to convert a boxed value to a number. If this fails,
return undefined.
*/
function boxToNumber(boxVal)
{
    "tachyon:static";
    "tachyon:noglobal";

    if (boxIsInt(boxVal))
        return boxVal;

    if (boxIsString(boxVal))
        return strToInt(boxVal);

    if (boxIsExtObj(boxVal))
        return strToInt(boxToString(boxVal));

    if (boxVal === null)
        return 0;

    if (boxVal === true)
        return 1;

    if (boxVal === false)
        return 0;

    // TODO: return NaN when available
    return UNDEFINED;
}

/**
Attempt to convert a boxed value to an int32. If this fails,
return undefined.
*/
function boxToInt32(boxVal)
{
    "tachyon:ret i32";

    var numVal = boxToNumber(boxVal);

    if (boxIsInt(numVal))
    {
        var num = iir.icast(IRType.i32, unboxInt(numVal));

        return num;
    }

    // TODO: handle floats

    return i32(0);
}

/**
Test if a boxed value is a 32-bit integer
*/
function boxIsInt32(boxVal)
{
    "tachyon:inline";

    if (boxIsInt(boxVal))
    {
        var intVal = unboxInt(boxVal);

        return (intVal >= MIN_INT32 && intVal <= MAX_INT32);
    }

    return false;
}

/**
Convert a boxed value to a string
*/
function boxToString(val)
{
    "tachyon:static";

    if (boxIsInt(val))
    {
        return getIntStr(unboxInt(val), pint(10));
    }

    if (boxIsString(val))
    {
        return val;
    }

    if (boxIsExtObj(val))
    {
        var res = val.toString();

        if (boxIsExtObj(res))
            typeError('cannot convert object to string');
        else
            return boxToString(res);
    }

    switch (val)
    {
        case UNDEFINED:
        return 'undefined';

        case null:
        return 'null';

        case true:
        return 'true';

        case false:
        return 'false';

        default:
        error('unsupported value type in boxToString');
    }
}

/**
Cast a boxed integer value to the pint type
*/
function pint(boxVal)
{
    "tachyon:inline";
    "tachyon:noglobal";
    "tachyon:ret pint";

    // Unbox the integer directly
    return unboxInt(boxVal);
}

/**
Cast a boxed integer value to the puint type
*/
function puint(boxVal)
{
    "tachyon:inline";
    "tachyon:ret puint";

    // Unbox the integer directly
    return iir.icast(IRType.puint, unboxInt(boxVal));
}

/**
Cast a boxed integer value to the i32 type
*/
function i32(boxVal)
{
    "tachyon:inline";
    "tachyon:ret i32";

    // Unbox the integer and cast it
    return iir.icast(IRType.i32, unboxInt(boxVal));
}

/**
Cast a boxed integer value to the u32 type
*/
function u32(boxVal)
{
    "tachyon:inline";
    "tachyon:ret u32";

    // Unbox the integer and cast it
    return iir.icast(IRType.u32, unboxInt(boxVal));
}

/**
Cast a boxed integer value to the i16 type
*/
function i16(boxVal)
{
    "tachyon:inline";
    "tachyon:ret i16";

    // Unbox the integer and cast it
    return iir.icast(IRType.i16, unboxInt(boxVal));
}

/**
Cast a boxed integer value to the u16 type
*/
function u16(boxVal)
{
    "tachyon:inline";
    "tachyon:ret u16";

    // Unbox the integer and cast it
    return iir.icast(IRType.u16, unboxInt(boxVal));
}

/**
Cast a boxed integer value to the i8 type
*/
function i8(boxVal)
{
    "tachyon:inline";
    "tachyon:ret i8";

    // Unbox the integer and cast it
    return iir.icast(IRType.i8, unboxInt(boxVal));
}

/**
Cast a boxed integer value to the u8 type
*/
function u8(boxVal)
{
    "tachyon:inline";
    "tachyon:ret u8";

    // Unbox the integer and cast it
    return iir.icast(IRType.u8, unboxInt(boxVal));
}

//=============================================================================
//
// Implementation of JavaScript primitives (IR instructions)
//
//=============================================================================

/**
Create a new object with no properties
*/
function newObject(proto)
{
    "tachyon:static";
    "tachyon:noglobal";

    assert (
        proto === null || boxIsExtObj(proto),
        'invalid object prototype'
    );

    // Allocate space for an object
    var obj = alloc_obj();

    //iir.trace_print('allocated obj:');
    //printPtr(iir.icast(IRType.rptr, obj));

    // Initialize the prototype object
    set_obj_proto(obj, proto);

    // Initialize the number of properties
    set_obj_numprops(obj, u32(0));

    // Allocate space for a hash table
    var hashtbl = alloc_hashtbl(HASH_MAP_INIT_SIZE);

    // Set the hash table reference
    set_obj_tbl(obj, hashtbl);

    // Return the object reference
    return obj;
}

/**
Create a new empty array
*/
function newArray(capacity)
{
    "tachyon:static";
    "tachyon:noglobal";
    "tachyon:arg capacity pint";

    // Allocate space for an array
    var arr = alloc_arr();

    // Set the prototype to the array prototype object
    var arrproto = get_ctx_arrproto(iir.get_ctx());
    set_obj_proto(arr, arrproto);

    // Initialize the number of properties
    set_obj_numprops(arr, u32(0));

    // Initialize the array length
    set_arr_len(arr, u32(0));

    // Allocate space for a hash table and set the hash table reference
    var hashtbl = alloc_hashtbl(HASH_MAP_INIT_SIZE);
    set_obj_tbl(arr, hashtbl);

    // Allocate space for an array table and set the table reference
    var arrtbl = alloc_arrtbl(capacity);
    set_arr_arr(arr, arrtbl);

    // Return the array reference
    return arr;
}

/**
Create a blank object with no properties which inherits from the
default object prototype object.
*/
function blankObject()
{
    "tachyon:static";
    "tachyon:noglobal";

    var objproto = get_ctx_objproto(iir.get_ctx());

    return newObject(objproto);
}

/**
Create a blank array with a given capacity.
*/
function blankArray(capacity)
{
    "tachyon:static";
    "tachyon:noglobal";

    return newArray(unboxInt(capacity));
}

/**
Create a closure for a function
*/
function makeClos(funcPtr, numCells)
{
    "tachyon:static"; 
    "tachyon:noglobal";
    "tachyon:arg funcPtr rptr";
    "tachyon:arg numCells pint";

    // Allocate space for the closure
    var clos = alloc_clos(numCells);

    // Get a reference to the context
    var ctx = iir.get_ctx();

    // Set the prototype to the function prototype object
    var funcproto = get_ctx_funcproto(ctx);
    set_obj_proto(clos, funcproto);

    // Set the function pointer
    set_clos_funcptr(clos, funcPtr);

    // Initialize the number of properties
    set_obj_numprops(clos, u32(0));

    // Allocate space for a hash table and set the hash table reference
    var hashtbl = alloc_hashtbl(HASH_MAP_INIT_SIZE);
    set_obj_tbl(clos, hashtbl);

    // Return the closure reference
    return clos;
}

/**
Create the ".prototype" object for a function's closure
*/
function makeClosProto(clos)
{
    "tachyon:static"; 
    "tachyon:noglobal";

    // Get a reference to the context
    var ctx = iir.get_ctx();

    // Create a prototype object for the function
    var objproto = get_ctx_objproto(ctx);
    clos.prototype = newObject(objproto);
}

/**
Create a mutable closure cell
*/
function makeCell() 
{ 
    "tachyon:inline";
    "tachyon:noglobal";

    // Allocate space for the cell
    var cell = alloc_cell();

    // Return a reference to the cell
    return cell;
}

/**
Allocate the arguments table for the arguments object.
*/
function allocArgTable(numArgs)
{
    "tachyon:static";
    "tachyon:noglobal";
    "tachyon:arg numArgs pint";
    "tachyon:ret ref";

    //iir.trace_print('allocArgTable');

    // Allocate space for an array table
    var arrtbl = alloc_arrtbl(numArgs);

    //iir.trace_print('leaving allocArgTable');

    // Return the table reference
    return unboxRef(arrtbl);
}

/**
Create the arguments object.
*/
function makeArgObj(funcObj, numArgs, argTable)
{
    "tachyon:static"; 
    "tachyon:noglobal";
    "tachyon:arg numArgs pint";
    "tachyon:arg argTable ref";

    // Allocate space for an array
    var arr = alloc_arr();

    // Set the prototype to the object prototype object
    var objproto = get_ctx_objproto(iir.get_ctx());
    set_obj_proto(arr, objproto);

    // Initialize the number of properties
    set_obj_numprops(arr, u32(0));

    // Initialize the array length
    set_arr_len(arr, iir.icast(IRType.u32, numArgs));

    // Box the arguments table reference
    argTable = boxRef(argTable, TAG_OTHER);

    // Set the array table pointer to the arguments table
    set_arr_arr(arr, argTable);

    // Allocate space for a hash table and set the hash table reference
    var hashtbl = alloc_hashtbl(HASH_MAP_INIT_SIZE);
    set_obj_tbl(arr, hashtbl);

    // Initialize the callee variable to the function object
    arr.callee = funcObj;

    // Return the array reference
    return arr;
}

/**
Implementation of the HIR less-than instruction
*/
function lt(v1, v2)
{
    "tachyon:static";

    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_lt(v1, v2))
            return true;
        else
            return false;
    }

    // Convert both values to primitives
    var px = boxToPrim(v1);
    var py = boxToPrim(v2);

    // If both values are immediate integers
    if (boxIsInt(px) && boxIsInt(py))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_lt(px, py))
            return true;
        else
            return false;
    }

    // If both values are strings
    if (boxIsString(px) && boxIsString(py))
    {
        // Perform string comparison
        return strcmp(px, py) < pint(0);
    }

    // Attempt to convert both values to numbers
    var nx = boxToNumber(px);
    var ny = boxToNumber(py);
    
    // If both values are immediate integers
    if (boxIsInt(nx) && boxIsInt(ny))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_lt(nx, ny))
            return true;
        else
            return false;
    }

    // The values are not comparable
    return false;
}

/**
Implementation of the HIR less-than-or-equal instruction
*/
function le(v1, v2)
{
    "tachyon:static";

    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_le(v1, v2))
            return true;
        else
            return false;
    }

    // Convert both values to primitives
    var px = boxToPrim(v1);
    var py = boxToPrim(v2);

    // If both values are boxed integers
    if (boxIsInt(px) && boxIsInt(py))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_le(px, py))
            return true;
        else
            return false;
    }

    // If both values are strings
    if (boxIsString(px) && boxIsString(py))
    {
        // Perform string comparison
        return strcmp(px, py) <= pint(0);
    }

    // Attempt to convert both values to numbers
    var nx = boxToNumber(px);
    var ny = boxToNumber(py);
    
    // If both values are immediate integers
    if (boxIsInt(nx) && boxIsInt(ny))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_le(nx, ny))
            return true;
        else
            return false;
    }

    // The values are not comparable
    return false;
}

/**
Implementation of the HIR greater-than instruction
*/
function gt(v1, v2)
{
    "tachyon:static";

    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_gt(v1, v2))
            return true;
        else
            return false;
    }

    // Convert both values to primitives
    var px = boxToPrim(v1);
    var py = boxToPrim(v2);

    // If both values are immediate integers
    if (boxIsInt(px) && boxIsInt(py))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_gt(px, py))
            return true;
        else
            return false;
    }

    // If both values are strings
    if (boxIsString(px) && boxIsString(py))
    {
        // Perform string comparison
        return strcmp(px, py) > pint(0);
    }

    // Attempt to convert both values to numbers
    var nx = boxToNumber(px);
    var ny = boxToNumber(py);
    
    // If both values are immediate integers
    if (boxIsInt(nx) && boxIsInt(ny))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_gt(nx, ny))
            return true;
        else
            return false;
    }

    // The values are not comparable
    return false;
}

/**
Implementation of the HIR greater-than-or-equal instruction
*/
function ge(v1, v2)
{
    "tachyon:static";

    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_ge(v1, v2))
            return true;
        else
            return false;
    }

    // Convert both values to primitives
    var px = boxToPrim(v1);
    var py = boxToPrim(v2);

    // If both values are immediate integers
    if (boxIsInt(px) && boxIsInt(py))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_ge(px, py))
            return true;
        else
            return false;
    }

    // If both values are strings
    if (boxIsString(px) && boxIsString(py))
    {
        // Perform string comparison
        return strcmp(px, py) >= pint(0);
    }

    // Attempt to convert both values to numbers
    var nx = boxToNumber(px);
    var ny = boxToNumber(py);
    
    // If both values are immediate integers
    if (boxIsInt(nx) && boxIsInt(ny))
    {
        // Compare the immediate integers directly without unboxing them
        if (iir.if_ge(nx, ny))
            return true;
        else
            return false;
    }

    // The values are not comparable
    return false;
}

/**
Implementation of the HIR equal instruction
*/
function eq(x, y)
{
    "tachyon:static";

    // If both values are the same, they are equal
    if (iir.if_eq(x, y))
        return true;

    // If both values are immediate integers, they are not equal
    if (boxIsInt(x) && boxIsInt(y))
        return false;

    // If both values are strings, they are not equal
    if (boxIsString(x) && boxIsString(y))
        return false;

    assert (
        !boxIsFloat(x) && !boxIsFloat(y),
        'equality comparison on floats not implemented'
    );

    if (x === null && y === UNDEFINED)
        return true;

    if (x === UNDEFINED && y === null)
        return true;

    if (typeof x === 'number' && typeof y === 'string')
        return x == boxToNumber(y);

    if (typeof x === 'string' && typeof y === 'number')
        return boxToNumber(x) == y;

    if (typeof x === 'boolean')
        return boxToNumber(x) == y;

    if (typeof y === 'boolean')
        return x == boxToNumber(y);

    if ((typeof x === 'string' || typeof x === 'number') && boxIsExtObj(y))
        return x == boxToPrim(y);

    if (boxIsExtObj(x) && (typeof y === 'string' || typeof y === 'number'))
        return boxToPrim(x) == y;

    // The values are not comparable
    return false;
}

/**
Implementation of HIR ne instruction
*/
function ne(v1, v2)
{
    "tachyon:static";
    
    // Perform the negation of the equality comparison
    return !eq(v1, v2);
}

/**
Implementation of HIR strict-equality instruction
*/
function se(v1, v2)
{
    "tachyon:static";
    
    // If both values are floating-point
    if (boxHasTag(v1, TAG_FLOAT) && boxHasTag(v2, TAG_FLOAT))
    {
        // TODO: implement FP case in separate(non-inlined) function
        error('se on float values');
    }
    else
    {
        // Compare the boxed value directly without unboxing them
        // This will compare for equality of reference in the case of
        // references and compare immediate integers directly
        if (iir.if_eq(v1, v2))
            return true;
        else
            return false;
    }
}

/**
Implementation of HIR strict-inequality instruction
*/
function ns(v1, v2)
{
    "tachyon:static";
    
    // If both values are floating-point
    if (boxHasTag(v1, TAG_FLOAT) && boxHasTag(v2, TAG_FLOAT))
    {
        // TODO: implement FP case in separate(non-inlined) function
        error('ns on float values');
    }
    else
    {
        // Compare the boxed value directly without unboxing them
        // This will compare for inequality of reference in the case of
        // references and compare immediate integers directly
        if (iir.if_ne(v1, v2))
            return true;
        else
            return false;
    }
}

/**
Implementation of the HIR add instruction
*/
function add(v1, v2)
{
    "tachyon:static";

    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Attempt an add with overflow check
        var intResult;
        if (intResult = iir.add_ovf(v1, v2))
        {
            // If there is no overflow, return the result
            // No normalization necessary
            return intResult;
        }
        else
        {
            // TODO: 
            // Overflow handling: need to create FP objects
            error('addition overflow');
        }
    }
    
    // If the left value is a string
    if (boxIsString(v1))
    {
        // If the right value is not a string
        if (boxIsString(v2) === false)
        {
            // Convert the right value to a string
            v2 = boxToString(v2);
        }

        // Perform string concatenation
        return strcat(v1, v2);
    }

    // If the right value is a string
    else if (boxIsString(v2))
    {
        // Convert the left value to a string
        v1 = boxToString(v1);

        // Perform string concatenation
        return strcat(v1, v2);
    }

    // Otherwise, both values are not strings
    else
    {
        // Convert both values to strings
        v1 = boxToString(v1);
        v2 = boxToString(v2);

        // Perform string concatenation
        return strcat(v1, v2);
    }
}

/**
Implementation of the HIR sub instruction
*/
function sub(v1, v2)
{
    "tachyon:static";

    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Attempt a subtract with overflow check
        var intResult;
        if (intResult = iir.sub_ovf(v1, v2))
        {
            // If there is no overflow, return the result
            // No normalization necessary
            return intResult;
        }
        else
        {
            // TODO
            // Overflow handling: need to create FP objects
            error('subtraction overflow');
        }
    }
    
    // TODO
    error('subtraction of non-integer values');
}

/**
Implementation of the HIR mul instruction
*/
function mul(v1, v2)
{
    "tachyon:static";
    
    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Cast the values to the pint type
        v1 = iir.icast(IRType.pint, v1);
        v1 = v1 >> TAG_NUM_BITS_INT;
        v2 = iir.icast(IRType.pint, v2);

        // Attempt a multiply with overflow check
        var intResult;
        if (intResult = iir.mul_ovf(v1, v2))
        {
            intResult = iir.icast(IRType.box, intResult);
            return intResult;
        }
        else
        {
            // TODO: overflow handling: need to create FP objects
            error('multiplication overflow');
        }    
    }
    else
    {
        // TODO: implement general case in separate (non-inlined) function
        error('multiplication of non-integer values');
    }
}

/**
Implementation of the HIR div instruction
*/
function div(v1, v2)
{
    "tachyon:static";
    
    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Cast the values to the pint type
        v1 = iir.icast(IRType.pint, v1);
        v2 = iir.icast(IRType.pint, v2);

        // Perform a raw machine division
        // The tag bits will cancel out
        var divRes = iir.div(v1, v2);

        // Box the result value
        return boxInt(divRes);
    }
    else
    {
        // TODO: implement general case in separate (non-inlined) function
        error('division of non-integer values');
    }
}

/**
Implementation of the HIR mod instruction
*/
function mod(v1, v2)
{
    "tachyon:static";
    
    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Perform a raw machine modulo
        // The tag bits will not cancel out
        return iir.mod(v1, v2);
    }
    else
    {
        // TODO: implement general case in separate (non-inlined) function
        error('modulo of non-integer values');
    }
}

/**
Unary bitwise negation operator
*/
function not(v) 
{ 
    "tachyon:static";
        
    // If the value is an immediate integer
    if (boxIsInt(v))
    {
        // Perform a raw machine negation
        return boxInt(iir.not(unboxInt(v)));
    }
    else
    {
        // TODO: implement general case in separate (non-inlined) function
        error('bitwise NOT of non-integer value');
    }    
}

/**
Bitwise AND primitive
*/
function and(v1, v2)
{
    "tachyon:static";
    
    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Perform a raw machine logical AND
        // The tag bits will remain 0
        return iir.and(v1, v2);
    }
    else
    {
        v1 = boxToInt32(v1);
        v2 = boxToInt32(v2);

        var res = iir.and(v1, v2);

        res = boxInt(iir.icast(IRType.pint, res));

        assert (
            boxIsInt32(res),
            'and result is not int32'
        );

        return res;
    }
}

/**
Bitwise OR primitive
*/
function or(v1, v2)
{
    "tachyon:static";
    
    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Perform a raw machine logical OR
        // The tag bits will remain 0
        return iir.or(v1, v2);
    }
    else
    {
        v1 = boxToInt32(v1);
        v2 = boxToInt32(v2);

        var res = iir.or(v1, v2);

        res = boxInt(iir.icast(IRType.pint, res));

        assert (
            boxIsInt32(res),
            'or result is not int32'
        );

        return res;
    }
}

/**
Bitwise XOR primitive
*/
function xor(v1, v2)
{
    "tachyon:static";
    
    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        // Perform a raw machine logical OR
        // The tag bits will remain 0
        return iir.xor(v1, v2);
    }
    else
    {
        v1 = boxToInt32(v1);
        v2 = boxToInt32(v2);

        var res = iir.xor(v1, v2);

        res = boxInt(iir.icast(IRType.pint, res));

        assert (
            boxIsInt32(res),
            'xor result is not int32'
        );

        return res;
    }
}

/**
Bitwise left shift primitive
*/
function lsft(v1, v2)
{
    "tachyon:static";
    
    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        v1 = iir.icast(IRType.i32, unboxInt(v1));
        v2 = iir.icast(IRType.i32, unboxInt(v2));

        var res = iir.lsft(v1, v2);

        return boxInt(iir.icast(IRType.pint, res));
    }
    else
    {
        v1 = boxToInt32(v1);
        v2 = boxToInt32(v2);

        v2 = v2 & i32(0x1F);

        var res = iir.lsft(v1, v2);

        res = boxInt(iir.icast(IRType.pint, res));

        assert (
            boxIsInt32(res),
            'lsft result is not int32'
        );

        return res;
    }
}

/**
Bitwise right shift primitive
*/
function rsft(v1, v2)
{
    "tachyon:static";
    
    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        v1 = iir.icast(IRType.i32, unboxInt(v1));
        v2 = iir.icast(IRType.i32, unboxInt(v2));

        var res = iir.rsft(v1, v2);

        return boxInt(iir.icast(IRType.pint, res));
    }
    else
    {
        v1 = boxToInt32(v1);
        v2 = boxToInt32(v2);

        var res = iir.rsft(v1, v2);

        res = boxInt(iir.icast(IRType.pint, res));

        assert (
            boxIsInt32(res),
            'rsft result is not int32'
        );

        return res;
    }
}

/**
Bitwise unsigned right shift primitive
*/
function ursft(v1, v2)
{
    "tachyon:static";
    
    // If both values are immediate integers
    if (boxIsInt(v1) && boxIsInt(v2))
    {
        v1 = iir.icast(IRType.i32, unboxInt(v1));
        v2 = iir.icast(IRType.i32, unboxInt(v2));

        var res = iir.ursft(v1, v2);

        return boxInt(iir.icast(IRType.pint, res));
    }
    else
    {
        v1 = boxToInt32(v1);
        v2 = boxToInt32(v2);

        var res = iir.ursft(v1, v2);

        res = boxInt(iir.icast(IRType.pint, res));

        assert (
            res >= 0,
            'ursft result is negative'
        );

        return res;
    }
}

/**
Typeof unary operator
*/
function typeOf(val)
{ 
    "tachyon:static";
    "tachyon:noglobal";

    if (boxIsInt(val) || boxIsFloat(val))
        return "number";
    else if (boxIsString(val))
        return "string";
    else if (val === true || val === false)
        return "boolean";
    else if (val === UNDEFINED)
        return "undefined";
    else if (val === null)
        return "object";
    else if (boxIsObj(val) || boxIsArray(val))
        return "object";
    else if (boxIsFunc(val))
        return "function";

    error('unsupported type in typeOf');
}

/**
Set a property on an object
*/
function putPropObj(obj, propName, propHash, propVal)
{
    "tachyon:inline";
    "tachyon:noglobal";
    "tachyon:arg propHash pint";

    assert (
        boxIsExtObj(obj),
        'putPropObj on non-object'
    );

    assert (
        boxIsString(propName),
        'putPropObj with non-string property'
    );

    //
    // TODO: find if getter-setter exists?
    // Requires first looking up the entry in the whole prototype chain...
    //

    // Get a pointer to the hash table
    var tblPtr = get_obj_tbl(obj);

    // Get the size of the hash table
    var tblSize = iir.icast(
        IRType.pint,
        get_hashtbl_size(tblPtr)
    );

    // Get the hash table index for this hash value
    // compute this using unsigned modulo to always obtain a positive value
    var hashIndex = iir.icast(
        IRType.pint,
        iir.icast(IRType.u32, propHash) % iir.icast(IRType.u32, tblSize)
    );

    //printInt(boxInt(hashIndex));

    // Until the key is found, or a free slot is encountered
    while (true)
    {
        // Get the key value at this hash slot
        var keyVal = get_hashtbl_tbl_key(tblPtr, hashIndex);

        // If this is the key we want
        if (keyVal === propName)
        {
            // Set the corresponding property value
            set_hashtbl_tbl_val(tblPtr, hashIndex, propVal);

            // Break out of the loop
            break;
        }

        // Otherwise, if we have reached an empty slot
        else if (keyVal === UNDEFINED)
        {
            // Set the corresponding key and value in the slot
            set_hashtbl_tbl_key(tblPtr, hashIndex, propName);
            set_hashtbl_tbl_val(tblPtr, hashIndex, propVal);

            // Get the number of properties and increment it
            var numProps = get_obj_numprops(obj);
            numProps++;
            set_obj_numprops(obj, numProps);
            numProps = iir.icast(IRType.pint, numProps);

            // Test if resizing of the hash map is needed
            // numProps > ratio * tblSize
            // numProps > num/denom * tblSize
            // numProps * denom > tblSize * num
            if (numProps * HASH_MAP_MAX_LOAD_DENOM >
                tblSize * HASH_MAP_MAX_LOAD_NUM)
            {
                // Extend the hash table for this object
                extObjHashTable(obj, tblPtr, tblSize);
            }

            // Break out of the loop
            break;
        }

        // Move to the next hash table slot
        hashIndex = (hashIndex + pint(1)) % tblSize;
    }
}

/**
Extend the hash table and rehash the properties of an object
*/
function extObjHashTable(obj, curTbl, curSize)
{
    "tachyon:inline";
    "tachyon:noglobal";
    "tachyon:arg curSize pint";

    assert (
        boxIsExtObj(obj),
        'extObjHashTable on non-object'
    );

    // Compute the new table size
    var newSize = curSize * pint(2) + pint(1);

    // Allocate a new, larger hash table
    var newTbl = alloc_hashtbl(newSize);

    // For each entry in the current table
    for (var curIdx = pint(0); 
         curIdx < curSize; 
         curIdx = curIdx + pint(1)
    )
    {
        // Get the key at this hash slot
        var propKey = get_hashtbl_tbl_key(curTbl, curIdx);

        // If this is an empty hash entry, skip it
        if (propKey === UNDEFINED)
            continue;

        // Get the value at this hash slot
        var propVal = get_hashtbl_tbl_val(curTbl, curIdx);

        // Get the hash code for the property
        var propHash = iir.icast(IRType.pint, get_str_hash(propKey));

        // Get the hash table index for this hash value in the new table
        // compute this using unsigned modulo to always obtain a positive value
        var startHashIndex = iir.icast(
            IRType.pint,
            iir.icast(IRType.u32, propHash) % iir.icast(IRType.u32, newSize)
        );
        var hashIndex = startHashIndex;

        // Until a free slot is encountered
        while (true)
        {
            // Get the key value at this hash slot
            var slotKey = get_hashtbl_tbl_key(newTbl, hashIndex);

            // If we have reached an empty slot
            if (slotKey === UNDEFINED)
            {
                // Set the corresponding key and value in the slot
                set_hashtbl_tbl_key(newTbl, hashIndex, propKey);
                set_hashtbl_tbl_val(newTbl, hashIndex, propVal);

                // Break out of the loop
                break;
            }

            // Move to the next hash table slot
            hashIndex = (hashIndex + pint(1)) % newSize;

            // Ensure that a free slot was found for this key
            assert (
                hashIndex !== startHashIndex,
                'no free slots found in extended hash table'
            );
        }
    }

    // Update the hash table pointer
    set_obj_tbl(obj, newTbl);
}

/**
Get a property from an object
*/
function getOwnPropObj(obj, propName, propHash)
{
    "tachyon:inline";
    "tachyon:noglobal";
    "tachyon:arg propHash pint";

    assert (
        boxIsExtObj(obj),
        'getOwnPropObj on non-object'
    );

    assert (
        boxIsString(propName),
        'getOwnPropObj with non-string property'
    );

    // Get a pointer to the hash table
    var tblPtr = get_obj_tbl(obj);

    // Get the size of the hash table
    var tblSize = iir.icast(
        IRType.pint,
        get_hashtbl_size(tblPtr)
    );

    // Get the hash table index for this hash value
    // compute this using unsigned modulo to always obtain a positive value
    var hashIndex = iir.icast(
        IRType.pint,
        iir.icast(IRType.u32, propHash) % iir.icast(IRType.u32, tblSize)
    );

    // Until the key is found, or a free slot is encountered
    while (true)
    {
        // Get the key value at this hash slot
        var keyVal = get_hashtbl_tbl_key(tblPtr, hashIndex);

        // If this is the key we want
        if (keyVal === propName)
        {
            // Load the property value
            var propVal = get_hashtbl_tbl_val(tblPtr, hashIndex);

            /*
            if (isGetterSetter(propVal))
                return callGetter(obj, propVal);
            else 
                return propVal;
            */

            // TODO
            return propVal;
        }

        // Otherwise, if we have reached an empty slot
        else if (keyVal === UNDEFINED)
        {
            break;
        }

        // Move to the next hash table slot
        hashIndex = (hashIndex + pint(1)) % tblSize;
    }

    // Property not found, return a special bit pattern
    return iir.icast(IRType.box, BIT_PATTERN_NOT_FOUND);
}

/**
Get a property from an object or its prototype chain
*/
function getPropObj(obj, propName, propHash)
{
    "tachyon:inline";
    "tachyon:noglobal";
    "tachyon:arg propHash pint";

    assert (
        boxIsExtObj(obj),
        'getPropObj on non-object'
    );

    assert (
        boxIsString(propName),
        'getPropObj with non-string property'
    );

    // Until we reach the end of the prototype chain
    do
    {
        // Lookup the property in the object
        var prop = getOwnPropObj(obj, propName, propHash);

        // If the property was found, return it
        if (prop !== iir.icast(IRType.box, BIT_PATTERN_NOT_FOUND)) {
            
            return prop;
        }

        // Move up in the prototype chain
        var obj = get_obj_proto(obj);

    } while (obj !== null);

    // Property not found, return a special bit pattern
    return iir.icast(IRType.box, BIT_PATTERN_NOT_FOUND);
}

/**
Delete a property from an object
*/
function delPropObj(obj, propName, propHash)
{
    "tachyon:inline";
    "tachyon:noglobal";
    "tachyon:arg propHash pint";

    assert (
        boxIsExtObj(obj),
        'delPropObj on non-object'
    );

    assert (
        boxIsString(propName),
        'delPropObj with non-string property'
    );

    // Get a pointer to the hash table
    var tblPtr = get_obj_tbl(obj);

    // Get the size of the hash table
    var tblSize = iir.icast(
        IRType.pint,
        get_hashtbl_size(tblPtr)
    );

    // Get the hash table index for this hash value
    // compute this using unsigned modulo to always obtain a positive value
    var hashIndex = iir.icast(
        IRType.pint,
        iir.icast(IRType.u32, propHash) % iir.icast(IRType.u32, tblSize)
    );

    // Until the key is found, or a free slot is encountered
    while (true)
    {
        // Get the key value at this hash slot
        var keyVal = get_hashtbl_tbl_key(tblPtr, hashIndex);

        // If this is the key we want
        if (keyVal === propName)
        {
            // Initialize the current free index to the removed item index
            var curFreeIndex = hashIndex;

            // Initialize the shift index to the next item
            var shiftIndex = (hashIndex + pint(1)) % tblSize;

            // For every subsequent item, until we encounter a free slot
            while (true)
            {
                // Get the key for the item at the shift index
                var shiftKey = get_hashtbl_tbl_key(tblPtr, shiftIndex);

                // If we have reached an empty slot, stop
                if (shiftKey === UNDEFINED)
                    break;

                // Calculate the index at which this item's hash key maps
                var origIndex = iir.icast(IRType.pint, get_str_hash(shiftKey)) % tblSize;

                // Compute the distance from the element to its origin mapping
                var distToOrig =
                    (shiftIndex < origIndex)? 
                    (shiftIndex + tblSize - origIndex):
                    (shiftIndex - origIndex);

                // Compute the distance from the element to the current free index
                var distToFree =
                    (shiftIndex < curFreeIndex)?
                    (shiftIndex + tblSize - curFreeIndex):
                    (shiftIndex - curFreeIndex);                    

                // If the free slot is between the element and its origin
                if (distToFree <= distToOrig)
                {
                    // Move the item into the free slot
                    var key = get_hashtbl_tbl_key(tblPtr, shiftIndex);
                    var val = get_hashtbl_tbl_val(tblPtr, shiftIndex);
                    set_hashtbl_tbl_key(tblPtr, curFreeIndex, key);
                    set_hashtbl_tbl_val(tblPtr, curFreeIndex, val);

                    // Update the current free index
                    curFreeIndex = shiftIndex;
                }

                // Move to the next item
                shiftIndex = (shiftIndex + pint(1)) % tblSize;
            }

            // Clear the hash key at the current free position
            set_hashtbl_tbl_key(tblPtr, curFreeIndex, UNDEFINED);

            // Decrement the number of items stored
            var numProps = get_obj_numprops(obj);
            numProps--;
            set_obj_numprops(obj, numProps);

            // Property deleted
            return true;
        }

        // Otherwise, if we have reached an empty slot
        else if (keyVal === UNDEFINED)
        {
            break;
        }

        // Move to the next hash table slot
        hashIndex = (hashIndex + pint(1)) % tblSize;
    }

    // Property not found
    return false;
}

/**
Set an element of an array
*/
function putElemArr(arr, index, elemVal)
{
    "tachyon:inline";
    "tachyon:noglobal";

    assert (
        boxIsArray(arr),
        'putElemArr on non-array'
    );

    assert (
        index >= 0,
        'negative array index'
    );

    index = unboxInt(index); 

    // Get the array length
    var len = iir.icast(IRType.pint, get_arr_len(arr));

    // Get the array table
    var tbl = get_arr_arr(arr);

    // If the index is outside the current size of the array
    if (index >= len)
    {
        // Compute the new length
        var newLen = index + pint(1);

        // Get the array capacity
        var cap = iir.icast(IRType.pint, get_arrtbl_size(tbl));

        // If the new length would exceed the capacity
        if (newLen > cap)
        {
            // Compute the new size to resize to
            var newSize = pint(2) * cap;
            if (newLen > newSize)
                newSize = newLen;

            // Extend the internal table
            tbl = extArrTable(arr, tbl, len, cap, newSize);
        }

        // Update the array length
        set_arr_len(arr, iir.icast(IRType.u32, newLen));
    }

    // Set the element in the array
    set_arrtbl_tbl(tbl, index, elemVal);
}

/**
Extend the internal array table of an array
*/
function extArrTable(arr, curTbl, curLen, curSize, newSize)
{
    "tachyon:inline";
    "tachyon:noglobal";
    "tachyon:arg curLen pint";
    "tachyon:arg curSize pint";
    "tachyon:arg newSize pint";

    assert (
        boxIsArray(arr),
        'extArrTable on non-array'
    );

    // Allocate the new table without initializing it, for performance
    var newTbl = alloc_noinit_arrtbl(newSize);

    // Copy elements from the old table to the new
    for (var i = pint(0); i < curLen; i++)
    {
        var elem = get_arrtbl_tbl(curTbl, i);
        set_arrtbl_tbl(newTbl, i, elem);
    }

    // Initialize the remaining table entries to undefined
    for (var i = curLen; i < newSize; i++)
    {
        set_arrtbl_tbl(newTbl, i, UNDEFINED);
    }

    // Update the table reference in the array
    set_arr_arr(arr, newTbl);

    return newTbl;
}

/**
Get an element from an array
*/
function getElemArr(arr, index)
{
    "tachyon:inline";
    "tachyon:noglobal";

    assert (
        boxIsArray(arr),
        'getElemArr on non-array'
    );

    assert (
        index >= 0,
        'negative array index'
    );

    index = unboxInt(index); 

    var len = iir.icast(IRType.pint, get_arr_len(arr));

    if (index >= len)
        return UNDEFINED;

    var tbl = get_arr_arr(arr);

    return get_arrtbl_tbl(tbl, index);
}

/**
Delete an element of an array
*/
function delElemArr(arr, index)
{
    "tachyon:inline";
    "tachyon:noglobal";

    assert (
        boxIsArray(arr),
        'delElemArr on non-array'
    );

    assert (
        index >= 0,
        'negative array index'
    );

    index = unboxInt(index); 

    // Get the array table
    var tbl = get_arr_arr(arr);

    // Set the array element to undefined
    set_arrtbl_tbl(tbl, index, UNDEFINED);

    // Get the array length
    var len = iir.icast(IRType.pint, get_arr_len(arr));

    // If this is the last array element
    if (index === len - pint(1))
    {
        // Compute the new length
        var newLen = index;

        // Update the array length
        set_arr_len(arr, iir.icast(IRType.u32, newLen));
    }
}

/**
Set the length of an array
*/
function setArrayLength(arr, newLen)
{
    "tachyon:static";
    "tachyon:noglobal";

    assert (
        boxIsArray(arr),
        'setArrayLength on non-array'
    );

    assert (
        newLen >= 0,
        'invalid array length'
    );

    newLen = unboxInt(newLen);

    // Get the current array length
    var len = iir.icast(IRType.pint, get_arr_len(arr));

    // Get a reference to the array table
    var tbl = get_arr_arr(arr);

    // If the array length is increasing
    if (newLen > len)
    {
        // Get the array capacity
        var cap = iir.icast(IRType.pint, get_arrtbl_size(tbl));

        // If the new length would exceed the capacity
        if (newLen > cap)
        {
            // Extend the internal table
            extArrTable(arr, tbl, len, cap, newLen);
        }
    }
    else
    {
        // Initialize removed entries to undefined
        for (var i = newLen; i < len; i++)
            set_arrtbl_tbl(tbl, i, UNDEFINED);
    }

    // Update the array length
    set_arr_len(arr, iir.icast(IRType.u32, newLen));
}

/**
Set a property on a value using a value as a key
*/
function putProp(obj, propName, propVal)
{
    "tachyon:static";
    "tachyon:noglobal";

    // If this is an array
    if (boxIsArray(obj))
    {
        if (boxIsInt(propName))
        {
            if (propName >= 0)
            {
                // Write the element in the array
                putElemArr(obj, propName, propVal);

                // Return early
                return;
            }
        }

        else
        {
            var numProp = boxToNumber(propName);

            if (boxIsInt(numProp))
            {
                if (numProp >= 0)
                {
                    // Write the element in the array
                    putElemArr(obj, numProp, propVal);

                    // Return early
                    return;
                }
            }
        
            if (boxIsString(propName) === false)
                propName = boxToString(propName);
                
            if (propName === 'length')
            {
                setArrayLength(obj, propVal);

                // Return early
                return;
            }
        }
    }

    // If the value is not an object
    if (boxIsExtObj(obj) === false)
    {
        // Return the property value
        return propVal;
    }

    // If the property is not a string, get its string value
    if (boxIsString(propName) === false)
        propName = boxToString(propName);

    // Get the hash code for the property
    var propHash = iir.icast(IRType.pint, get_str_hash(propName));

    // Set the property on the object
    putPropObj(obj, propName, propHash, propVal);

    // Return the property value
    return propVal;
}

/**
Get a property from a value using a value as a key
*/
function getProp(obj, propName)
{
    "tachyon:static";
    "tachyon:noglobal";

    // If this is an array
    if (boxIsArray(obj))
    {
        if (boxIsInt(propName))
        {
            if (propName >= 0)
            {
                // Get the element from the array
                var elem = getElemArr(obj, propName);

                // If the element is not undefined, return it
                if (elem !== UNDEFINED)
                    return elem;
            }
        }

        else
        {
            var numProp = boxToNumber(propName);

            if (boxIsInt(numProp))
            {
                // Get the element from the array
                var elem = getElemArr(obj, numProp);

                // If the element is not undefined, return it
                if (elem !== UNDEFINED)
                    return elem;
            }
        
            if (boxIsString(propName) === false)
                propName = boxToString(propName);
                
            if (propName === 'length')
            {
                return boxInt(iir.icast(IRType.pint, get_arr_len(obj)));
            }
        }
    }

    // If this is a string
    else if (boxIsString(obj))
    {
        if (propName === 'length')
        {
            return boxInt(iir.icast(IRType.pint, get_str_size(obj)));
        }

        else if (boxIsInt(propName))
        {
            if (propName >= 0 && propName < obj.length)
            {
                return obj.charAt(propName);
            }
        }

        else
        {
            var numProp = boxToNumber(propName);

            if (boxIsInt(propName))
            {
                if (propName >= 0 && propName < obj.length)
                {
                    return obj.charAt(propName);
                }
            }
        
            if (boxIsString(propName) === false)
                propName = boxToString(propName);
                
            if (propName === 'length')
            {
                return boxInt(iir.icast(IRType.pint, get_str_size(obj)));
            }
        }

        // Lookup the property on the string prototype object
        obj = get_ctx_strproto(iir.get_ctx());
    }

    // If this is a boxed integer
    else if (boxIsInt(obj))
    {
        // Lookup the property on the number prototype object
        obj = get_ctx_numproto(iir.get_ctx());
    }

    // If this is a boxed boolean
    else if (obj === true || obj === false)
    {
        // Lookup the property on the boolean prototype object
        obj = get_ctx_boolproto(iir.get_ctx());
    }

    // If the value is not an object
    else if (boxIsExtObj(obj) === false)
    {
        // Return the undefined value
        return UNDEFINED;
    }

    // If the property is not a string, get its string value
    if (boxIsString(propName) === false)
        propName = boxToString(propName);

    // Get the hash code for the property
    var propHash = iir.icast(IRType.pint, get_str_hash(propName));

    // Attempt to find the property on the object
    var prop = getPropObj(obj, propName, propHash);

    // If the property isn't defined
    if (iir.icast(IRType.pint, prop) === BIT_PATTERN_NOT_FOUND)
    {
        // Return the undefined value
        return UNDEFINED;
    }

    // Return the property value we found
    return prop;
}

/**
Test if a property exists on a value or in its prototype chain
using a value as a key
*/
function hasProp(obj, propName)
{
    "tachyon:static";
    "tachyon:noglobal";

    // If this is an array
    if (boxIsArray(obj))
    {
        if (boxIsInt(propName))
        {
            if (propName >= 0)
            {
                // Get the element from the array
                var elem = getElemArr(obj, propName);

                // If the element is not undefined, return true
                if (elem !== UNDEFINED)
                    return true;
            }
        }

        else
        {
            var numProp = boxToNumber(propName);

            if (boxIsInt(numProp))
            {
                // Get the element from the array
                var elem = getElemArr(obj, numProp);

                // If the element is not undefined, return it
                if (elem !== UNDEFINED)
                    return true;
            }
        
            if (boxIsString(propName) === false)
                propName = boxToString(propName);
                
            if (propName === 'length')
            {
                return true;
            }
        }
    }

    // If this is a string
    else if (boxIsString(obj))
    {
        var numProp = boxToNumber(propName);

        if (boxIsInt(propName))
        {
            if (propName >= 0 && propName < obj.length)
            {
                return true;
            }
        }
        
        if (boxIsString(propName) === false)
            propName = boxToString(propName);
                
        if (propName === 'length')
        {
            return true;
        }

        // Lookup the property on the string prototype object
        obj = get_ctx_strproto(iir.get_ctx());
    }

    // If this is a boxed integer
    else if (boxIsInt(obj))
    {
        // Lookup the property on the number prototype object
        obj = get_ctx_numproto(iir.get_ctx());
    }

    // If the property is not a string, get its string value
    if (boxIsString(propName) === false)
        propName = boxToString(propName);

    // Get the hash code for the property
    var propHash = iir.icast(IRType.pint, get_str_hash(propName));

    // Attempt to find the property on the object
    var prop = getPropObj(obj, propName, propHash);

    // Test if the property was found
    return iir.icast(IRType.pint, prop) !== BIT_PATTERN_NOT_FOUND;
}

/**
Test if a property exists on a value without looking at its prototype chain
*/
function hasOwnProp(obj, propName)
{
    "tachyon:static";
    "tachyon:noglobal";

    // If this is an array
    if (boxIsArray(obj))
    {
        if (boxIsInt(propName))
        {
            if (propName >= 0)
            {
                // Get the element from the array
                var elem = getElemArr(obj, propName);

                // If the element is not undefined, return true
                if (elem !== UNDEFINED)
                    return true;
            }
        }

        else
        {
            var numProp = boxToNumber(propName);

            if (boxIsInt(numProp))
            {
                // Get the element from the array
                var elem = getElemArr(obj, numProp);

                // If the element is not undefined, return it
                if (elem !== UNDEFINED)
                    return true;
            }
        
            if (boxIsString(propName) === false)
                propName = boxToString(propName);
                
            if (propName === 'length')
            {
                return true;
            }
        }
    }

    // If this is a string
    else if (boxIsString(obj))
    {
        var numProp = boxToNumber(propName);

        if (boxIsInt(propName))
        {
            if (propName >= 0 && propName < obj.length)
            {
                return true;
            }
        }
        
        if (boxIsString(propName) === false)
            propName = boxToString(propName);
                
        if (propName === 'length')
        {
            return true;
        }

        return false;
    }

    // If the property is not a string, get its string value
    if (boxIsString(propName) === false)
        propName = boxToString(propName);

    // Get the hash code for the property
    var propHash = iir.icast(IRType.pint, get_str_hash(propName));

    // Attempt to find the property on the object
    var prop = getOwnPropObj(obj, propName, propHash);

    // Test if the property was found
    return iir.icast(IRType.pint, prop) !== BIT_PATTERN_NOT_FOUND;
}

/**
Delete a property from a value
*/
function delProp(obj, propName)
{ 
    "tachyon:static"; 

    // If the object is an array
    if (boxIsArray(obj))
    {
        if (boxIsInt(propName))
        {
            if (propName >= 0)
            {
                // Delete the property and return early
                delElemArr(obj, propName);
                return;
            }
        }

        else
        {
            var numProp = boxToNumber(propName);

            if (boxIsInt(numProp))
            {
                if (propName >= 0)
                {
                    // Delete the property and return early
                    delElemArr(obj, propName);
                    return;
                }
            }
        }
    }

    // If the value is not an object
    if (boxIsExtObj(obj) === false)
    {
        // Operation succeeded
        return true;
    }

    // If the property is not a string, get its string value
    if (boxIsString(propName) === false)
        propName = boxToString(propName);

    // Get the hash code for the property
    var propHash = iir.icast(IRType.pint, get_str_hash(propName));

    // Delete the property on the object
    delPropObj(obj, propName, propHash);

    // Operation succeeded
    return true;
}

/**
Initialize a property on the global object if it doesn't already exist.
*/
function initGlobal(obj, propName)
{
    "tachyon:static";
    "tachyon:noglobal";

    if ((propName in obj) === false)
        obj[propName] = UNDEFINED;
}

/**
Get a property value from the global object
*/
function getGlobal(obj, propName)
{
    "tachyon:static";

    // Get the hash code for the property
    var propHash = iir.icast(IRType.pint, get_str_hash(propName));

    // Attempt to find the property on the object
    var prop = getPropObj(obj, propName, propHash);

    // If the property isn't defined
    if (iir.icast(IRType.pint, prop) === BIT_PATTERN_NOT_FOUND)
    {
        // Throw a ReferenceError exception
        throw refError('global property not defined "' + propName + '"');
    }

    // Return the property
    return prop;
}

/**
Used to enumerate properties in a for-in loop
*/
function getPropNames(obj)
{ 
    "tachyon:static"; 
    "tachyon:noglobal";

    // If the value is not an object
    if (boxIsExtObj(obj) === false)
    {
        // Return the empty enumeration function
        return function ()
        {
            return UNDEFINED;
        };
    }

    var curObj = obj;
    var curIdx = 0;

    // Check if a property is currently shadowed
    function isShadowed(propName)
    {
        "tachyon:noglobal";

        // TODO: shadowing check function?
        return false;
    }

    // Move to the next available property
    function nextProp()
    {
        "tachyon:noglobal";

        while (true)
        {
            // FIXME: for now, no support for non-enumerable properties
            if (curObj === get_ctx_objproto(iir.get_ctx())  || 
                curObj === get_ctx_arrproto(iir.get_ctx())  || 
                curObj === get_ctx_funcproto(iir.get_ctx()) ||
                curObj === get_ctx_strproto(iir.get_ctx()))
                return UNDEFINED;

            // If we are at the end of the prototype chain, stop
            if (curObj === null)
                return UNDEFINED;

            // If the current object is an object or extension
            if (boxIsExtObj(curObj))
            {
                // Get a pointer to the hash table
                var tblPtr = get_obj_tbl(curObj);

                // Get the size of the hash table
                var tblSize = iir.icast(
                    IRType.pint,
                    get_hashtbl_size(tblPtr)
                );

                // Until the key is found, or a free slot is encountered
                for (; unboxInt(curIdx) < tblSize; ++curIdx)
                {
                    // Get the key value at this hash slot
                    var keyVal = get_hashtbl_tbl_key(tblPtr, unboxInt(curIdx));

                    // FIXME: until we have support for non-enumerable properties
                    if (keyVal === 'length' ||
                        keyVal === 'callee')
                    {
                        ++curIdx;
                        continue;
                    }

                    // If this is a valid key, return it
                    if (keyVal !== UNDEFINED)
                    {
                        ++curIdx;
                        return keyVal;
                    }
                }

                // If the object is an array
                if (boxIsArray(curObj))
                {
                    var len = boxInt(iir.icast(IRType.pint, get_arr_len(curObj)));

                    var arrIdx = curIdx - boxInt(tblSize);

                    if (arrIdx < len)
                    {
                        ++curIdx;
                        return arrIdx;
                    }
                }

                // Move up the prototype chain
                curObj = get_obj_proto(curObj);
                curIdx = 0;
                continue;
            }

            // If the object is a string
            else if (boxIsString(curObj))
            {
                var len = boxInt(iir.icast(IRType.pint, get_str_size(curObj)));

                if (curIdx < len)
                {
                    return curIdx++;
                }
                else
                {
                    // Move up the prototype chain
                    curObj = get_ctx_strproto(iir.get_ctx());
                    curIdx = 0;
                    continue;
                }
            }

            else
            {
                return UNDEFINED;
            }
        }
    }

    // Enumerator function, returns a new property name with
    // each call, undefined when no more properties found
    function enumerator()
    {
        "tachyon:noglobal";

        while (true)
        {
            var propName = nextProp();

            if (isShadowed(propName))
                continue;

            return propName;
        }
    }

    return enumerator;
}

/**
Implementation of the "in" operator
*/
function inOp(propName, obj) 
{ 
    "tachyon:static"; 
    
    // If the value is not an object
    if (boxIsExtObj(obj) === false)
    {
        // Throw a TypeError exception
        typeError('in operator expects object');
    }

    return hasProp(obj, propName);
}

/**
Implementation of the "instanceof" operator
*/
function instanceOf(obj, ctor)
{ 
    "tachyon:static";

    // If the constructor is not a function
    if (boxIsFunc(ctor) === false)
    {
        // Throw a TypeError exception
        typeError('instanceOf expects function as constructor');
    }

    // If the value is not an object    
    if (boxIsExtObj(obj) === false)
    {
        // Return the false value
        return false;
    }

    // Get the prototype for the constructor function
    var ctorProto = ctor.prototype;

    // Until we went all the way through the prototype chain
    do
    {
        var objProto = get_obj_proto(obj);

        if (objProto === ctorProto)
            return true;

        obj = objProto;

    } while (obj !== null);

    return false;
}

