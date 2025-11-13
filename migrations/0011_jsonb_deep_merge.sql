-- Deep merge function for JSONB objects
-- Merges patch into target recursively, preserving fields not in patch

CREATE OR REPLACE FUNCTION jsonb_deep_merge(target jsonb, patch jsonb)
RETURNS jsonb AS $$
BEGIN
    -- If either is null, return the non-null one
    IF target IS NULL THEN
        RETURN patch;
    END IF;
    IF patch IS NULL THEN
        RETURN target;
    END IF;
    
    -- If both are objects, merge recursively
    IF jsonb_typeof(target) = 'object' AND jsonb_typeof(patch) = 'object' THEN
        RETURN (
            SELECT jsonb_object_agg(
                COALESCE(t.key, p.key),
                CASE
                    -- Key only in patch
                    WHEN t.value IS NULL THEN p.value
                    -- Key only in target
                    WHEN p.value IS NULL THEN t.value
                    -- Both have key and both are objects - recurse
                    WHEN jsonb_typeof(t.value) = 'object' AND jsonb_typeof(p.value) = 'object'
                        THEN jsonb_deep_merge(t.value, p.value)
                    -- Both have key but not both objects - patch wins
                    ELSE p.value
                END
            )
            FROM jsonb_each(target) t
            FULL OUTER JOIN jsonb_each(patch) p ON t.key = p.key
        );
    END IF;
    
    -- Not both objects - patch replaces target
    RETURN patch;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Test the function
DO $$
DECLARE
    target jsonb := '{"a": 1, "b": {"c": 2, "d": 3}, "e": 4}'::jsonb;
    patch jsonb := '{"b": {"d": 999}, "f": 5}'::jsonb;
    result jsonb;
BEGIN
    result := jsonb_deep_merge(target, patch);
    -- Expected: {"a": 1, "b": {"c": 2, "d": 999}, "e": 4, "f": 5}
    ASSERT result->>'a' = '1', 'Field a should be preserved';
    ASSERT (result->'b')->>'c' = '2', 'Field b.c should be preserved';
    ASSERT (result->'b')->>'d' = '999', 'Field b.d should be updated';
    ASSERT result->>'e' = '4', 'Field e should be preserved';
    ASSERT result->>'f' = '5', 'Field f should be added';
    RAISE NOTICE 'jsonb_deep_merge tests passed!';
END $$;

