ALTER TABLE topic_variations
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULLL;

--populate existing data with user id

UPDATE topic_variations 
SET user_id =t.user_id
FROM topics t 
WHERE  tv.source_topic_id = t.i
AND tv.user_id is NULL;

CREATE INDEX IF NOT EXISTS ids_topic_variations_user_id ON topic_varaitons(user_id);

--=================================================================================
--Composite patern for common query paterns
--=================================================================================

CREATE INDEX IF NOT EXISTS ids_topics_user_plateform ON topics(user_id,plaform);
--query pending topics
CREATE INDEX IF NOT EXISTS ids_topics_user_status ON topics(user_id, status);
--my analytics per plateform
CREATE INDEX IF NOT EXISTS ids_video_analytics_user_plateform ON video_analytics(user_id,plateform);
---winning patterns queries per plateforms
CREATE INDEX IF NOT EXISTS ids_winning_patterns_user_plateform ON winning_patterns(user_id,plaform);
--Pending post
CREATE  INDEX  IF EXISTS ids_post_queue_user_status ON post_queue(user_id, status);
-- active expeppriments
CREATE INDEX IF EXISTS NOT EXISTS idx_ab_experiments_user_status_status ON ab_experiments(user_id, status)

